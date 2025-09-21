import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { RabbitMQPublisherService } from '../publisher/rabbitmq-publisher.service';

type DueRow = {
  id: string;
  notification_type: string;
  payload: any;
  idempotency_key: string;
};

@Injectable()
export class NotificationsScedulerWorkerService {
  private readonly log = new Logger(NotificationsScedulerWorkerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: RabbitMQPublisherService,
  ) {}

  // every 5 seconds
  @Cron('*/5 * * * * *')
  async tick() {
    const BATCH = Number(
      process.env.SCHEDULE_BATCH ?? process.env.OUTBOX_BATCH ?? 500,
    );
    this.log.debug(`Scheduler tick start (batch=${BATCH})`);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let rows: DueRow[] = [];
    try {
      // Lock due rows (scheduled_for <= now()), avoid contention via SKIP LOCKED
      const res = await qr.query(
        `
        SELECT id::text, notification_type, payload, idempotency_key
        FROM scheduled_notifications
        WHERE scheduled_for <= now()
        ORDER BY scheduled_for
        FOR UPDATE SKIP LOCKED
        LIMIT $1;
        `,
        [BATCH],
      );
      rows = res ?? [];

      if (rows.length === 0) {
        await qr.commitTransaction();
        this.log.debug('No due notifications');
        return;
      }

      this.log.log(`Publishing ${rows.length} due notifications...`);

      const successIds: string[] = [];
      for (const r of rows) {
        try {
          // messageId for idempotency on the broker (optional)
          const messageId = `${r.notification_type}:${r.idempotency_key}`;
          await this.publisher.publish(
            r.notification_type,
            r.payload,
            messageId,
          );
          successIds.push(r.id);
        } catch (err) {
          this.log.warn(
            `Publish failed for scheduled ${r.id}: ${String((err as Error)?.message ?? err)}`,
          );
          // leave row for retry on next tick
        }
      }

      if (successIds.length > 0) {
        await qr.query(
          `DELETE FROM scheduled_notifications WHERE id = ANY($1::bigint[])`,
          [successIds.map((x) => BigInt(x))],
        );
        this.log.log(`Deleted ${successIds.length} delivered notifications`);
      } else {
        this.log.warn('No notifications were delivered this tick');
      }

      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      this.log.error('Scheduler tick failed', e as Error);
    } finally {
      await qr.release();
    }
  }
}
