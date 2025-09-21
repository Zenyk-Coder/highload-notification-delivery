import { Module } from '@nestjs/common';
import { NotificationsScedulerService } from './notifications-sceduler.service';
import { RabbitMQPublisherModule } from '../publisher/rabbitmq-publisher.module';
import { NotificationsScedulerWorkerService } from './notiifcations-sceduler.worker';

@Module({
  imports: [RabbitMQPublisherModule],
  controllers: [],
  providers: [NotificationsScedulerService, NotificationsScedulerWorkerService],
  exports: [NotificationsScedulerService],
})
export class NotificationsScedulerModule {}
