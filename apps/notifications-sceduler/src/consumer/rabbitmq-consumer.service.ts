import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { NotificationsScedulerService } from '../scheduler/notifications-sceduler.service';

@Injectable()
export class RabbitMQConsumerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMQConsumerService.name);

  private conn!: amqp.Connection;
  private ch!: amqp.Channel;

  constructor(
    private readonly notificationsSchedulerService: NotificationsScedulerService,
  ) {}

  async onModuleInit() {
    // RabbitMQ
    const amqpUrl = process.env.AMQP_URL || 'amqp://localhost';
    this.logger.log(`Connecting to RabbitMQ at ${maskAmqpUrl(amqpUrl)} ...`);
    try {
      this.conn = await amqp.connect(amqpUrl);
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

      this.ch = await this.conn.createChannel();
      this.logger.log('RabbitMQ channel created');

      this.ch.on('error', (err) =>
        this.logger.error(`RabbitMQ channel error: ${err.message}`, err.stack),
      );
      this.ch.on('close', () => this.logger.warn('RabbitMQ channel closed'));
      this.ch.on('return', (msg) =>
        this.logger.warn(
          `Unroutable message returned: id=${msg.properties.messageId} rk=${msg.fields.routingKey}`,
        ),
      );

      const exchange = process.env.EXCHANGE || 'events';
      const routingKey = process.env.ROUTING_KEY || 'user.created';
      const queue = process.env.QUEUE || 'user-events';
      const prefetch = parseInt(process.env.PREFETCH || '50', 10);

      await this.ch.assertExchange(exchange, 'topic', { durable: true });
      this.logger.log(`Exchange asserted: ${exchange}`);

      await this.ch.assertQueue(queue, { durable: true });
      this.logger.log(`Queue asserted: ${queue}`);

      await this.ch.bindQueue(queue, exchange, routingKey);
      this.logger.log(`Queue bound: ${queue} ← ${exchange}:${routingKey}`);

      await this.ch.prefetch(prefetch);
      this.logger.log(`Prefetch set to ${prefetch}`);

      await this.ch.consume(queue, (msg) => this.handleMessage(msg), {
        noAck: false,
      });
      this.logger.log(`Consumer started: ${exchange}:${routingKey} → ${queue}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to connect/init RabbitMQ: ${err?.message ?? err}`,
        err?.stack,
      );
      throw err;
    }
  }

  private async handleMessage(msg: amqp.ConsumeMessage | null) {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());

      await this.notificationsSchedulerService.handleUserCreatedEvent(
        content,
        msg?.properties?.messageId,
      );

      this.ch.ack(msg);
    } catch (err: any) {
      this.logger.error('Error handling message', err);
      const code = err?.code ?? err?.driverError?.code;
      // unique violation → ack to avoid endless retry
      if (code === '23505') {
        this.ch.ack(msg);
      } else {
        this.ch.nack(msg, false, true);
      }
    }
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down RabbitMQ consumer...');
    try {
      await this.ch?.close();
      this.logger.log('RabbitMQ channel closed');
    } catch (e: any) {
      this.logger.warn(`Error closing channel: ${e?.message ?? e}`);
    }
    try {
      await this.conn?.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (e: any) {
      this.logger.warn(`Error closing connection: ${e?.message ?? e}`);
    }
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
