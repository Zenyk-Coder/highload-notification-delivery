// rabbit.publisher.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitMQPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQPublisherService.name);
  private conn!: amqplib.Connection;
  private ch!: amqplib.ConfirmChannel;

  async onModuleInit() {
    const url = process.env.AMQP_URL;
    if (!url) {
      this.logger.error('AMQP_URL is not set');
      throw new Error('AMQP_URL is required');
    }

    this.logger.log(`Connecting to RabbitMQ at ${maskAmqpUrl(url)} ...`);
    try {
      this.conn = await amqplib.connect(url, { heartbeat: 30 });
      this.logger.log('RabbitMQ connection established');

      this.conn.on('error', (err) =>
        this.logger.error(
          `RabbitMQ connection error: ${err.message}`,
          err.stack,
        ),
      );
      this.conn.on('close', () =>
        this.logger.warn('RabbitMQ connection closed'),
      );

      this.ch = await this.conn.createConfirmChannel();
      this.logger.log('RabbitMQ confirm channel created');

      this.ch.on('error', (err) =>
        this.logger.error(`RabbitMQ channel error: ${err.message}`, err.stack),
      );
      this.ch.on('close', () => this.logger.warn('RabbitMQ channel closed'));

      await this.ch.assertExchange('events', 'topic', { durable: true });
      this.logger.log("RabbitMQ exchange 'events' asserted");
    } catch (err: any) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${err?.message ?? err}`,
        err?.stack,
      );
      throw err;
    }
  }

  async publish(routingKey: string, message: any, messageId: string) {
    const payload = Buffer.from(JSON.stringify(message));

    return new Promise<void>((resolve, reject) => {
      const ok = this.ch.publish(
        'events',
        routingKey,
        payload,
        {
          persistent: true,
          messageId,
          contentType: 'application/json',
        },
        (err) => (err ? reject(err) : resolve()), // confirm callback
      );

      if (!ok) {
        this.ch.once('drain', () => {
          // backpressure cleared; але resolve/reject зробить confirm callback вище
        });
      }
    });
  }

  async onModuleDestroy() {
    try {
      await this.ch?.close();
    } catch {}
    try {
      await this.conn?.close();
    } catch {}
  }
}

function maskAmqpUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.username) u.username = '***';
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return raw.replace(/\/\/[^@]+@/, '//***:***@');
  }
}
