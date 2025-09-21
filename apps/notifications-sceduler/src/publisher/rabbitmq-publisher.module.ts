import { Module } from '@nestjs/common';
import { RabbitMQPublisherService } from './rabbitmq-publisher.service';

@Module({
  imports: [],
  providers: [RabbitMQPublisherService],
  exports: [RabbitMQPublisherService],
})
export class RabbitMQPublisherModule {}
