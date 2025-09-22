// outbox-publisher.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { RabbitPublisher } from './rabbitmq-publisher.service';

type OutboxRow = { id: string; event_type: string; payload: any };

@Injectable()
export class UserOutboxEventService {
  private readonly log = new Logger(UserOutboxEventService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: RabbitPublisher,
  ) {}

  // run every 30 second; you can add adaptive backoff if needed
  @Cron('*/30 * * * * *')
  async tick() {
    this.log.debug('Outbox tick start');
    const BATCH = Number(process.env.OUTBOX_BATCH ?? 500);

    // 1) Start a transaction + lock rows so other instances won't take the same ones
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let rows: OutboxRow[] = [];
    try {
      // lock rows using SKIP LOCKED
      const idsRes = await qr.query(
        `
        SELECT id::text, event_type, payload
        FROM user_outbox_events
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT $1;
        `,
        [BATCH],
      );
      rows = idsRes;

      // if nothing to do — exit
      if (rows.length === 0) {
        await qr.commitTransaction();
        return;
      }

      // IMPORTANT: we KEEP THE TRANSACTION open while sending
      // (rows are locked and no one else can touch them).
      // So keep the batch size moderate (e.g. 200–500).

      const successIds: string[] = [];
      for (const r of rows) {
        try {
          this.log.log('Publishing outbox event', r);
          await this.publisher.publish(
            r.event_type,
            r.payload,
            `${r.event_type}-${r.payload.userId}`,
          );
          successIds.push(r.id);
        } catch (err) {
          // do not delete — leave for retry on the next tick
          this.log.warn(
            `publish failed for outbox ${r.id}: ${String((err as Error).message ?? err)}`,
          );
        }
      }

      if (successIds.length > 0) {
        // 2) Delete only successfully published
        await qr.query(
          `DELETE FROM user_outbox_events WHERE id = ANY($1::bigint[])`,
          [successIds.map((x) => BigInt(x))],
        );
      }

      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      this.log.error('outbox tick failed', e as Error);
    } finally {
      await qr.release();
    }
  }
}
