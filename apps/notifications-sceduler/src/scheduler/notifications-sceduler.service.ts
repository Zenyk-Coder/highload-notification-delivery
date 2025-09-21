import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm/data-source/index.js';
import { InsertResult } from 'typeorm/query-builder/result/InsertResult.js';
import { ScheduledNotification } from './entity/scheduled-notification.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class NotificationsScedulerService {
  private readonly logger = new Logger(NotificationsScedulerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async handleUserCreatedEvent(data: any, messageId: string) {
    const userId = data?.userId;
    if (!userId) throw new Error('userId is required in user.created');

    if (!messageId) throw new Error('messageId is required for idempotency');

    // schedule in 10 minutes
    const scheduledFor = new Date(Date.now() + 10 * 60 * 1000);
    const notificationType = 'notification.push';
    const payload = {
      userId,
      template: 'welcome',
      meta: { source: 'user.created' },
    };

    // ON CONFLICT DO NOTHING by unique idempotency_key
    const result: InsertResult = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(ScheduledNotification)
      .values({
        idempotencyKey: messageId,
        scheduledFor,
        notificationType,
        payload,
        userId,
      })
      .orIgnore() // -> ON CONFLICT DO NOTHING (Postgres)
      .returning('*') // Postgres: get inserted row if any
      .execute();

    if (result.raw.length > 0) {
      this.logger.debug(
        `Scheduled #${result.raw[0].id} (msgId=${messageId}) for user ${userId}`,
      );
    } else {
      this.logger.debug(`Duplicate message ignored (msgId=${messageId})`);
    }
    // Schedule a notification for the user
  }
}
