import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PushSenderService implements OnModuleDestroy {
  private readonly logger = new Logger(PushSenderService.name);
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );
  private readonly ttlSec = Number(process.env.IDEMPOTENCY_TTL ?? 60 * 60 * 3); // 3h
  private readonly url =
    process.env.PUSH_SINK_URL ??
    'https://webhook.site/878db1f3-c5a9-4a99-9755-68444e8af850';

  async handlePushEvent(data: any, messageId: string): Promise<void> {
    if (!messageId) throw new Error('messageId is required for idempotency');

    const key = messageId;

    // Try to claim the messageId (idempotency); skip if already processed
    const claimed = await this.redis.set(
      key,
      '1',
      'EX',
      this.ttlSec as number,
      'NX',
    );
    if (claimed !== 'OK') {
      this.logger.debug(`Duplicate push (messageId=${messageId}) - skipping`);
      return;
    }

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': messageId,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Push failed: ${res.status} ${res.statusText} ${text}`);
      }

      this.logger.log(`Push sent (messageId=${messageId})`);
    } catch (err) {
      // Allow retry by releasing the idempotency lock on failure
      await this.redis.del(key).catch(() => void 0);
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      await this.redis.disconnect();
    }
  }
}
