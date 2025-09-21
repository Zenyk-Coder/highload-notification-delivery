import { Module } from '@nestjs/common';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { NotificationsScedulerModule } from '../scheduler/notifications-sceduler.module';

@Module({
  imports: [NotificationsScedulerModule],
  providers: [RabbitMQConsumerService],
})
export class RabbitMQConsumerModule {}
