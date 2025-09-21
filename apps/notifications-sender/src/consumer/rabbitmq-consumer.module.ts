import { Module } from '@nestjs/common';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { PushSenderModule } from '../push-sender/push-sender.module';

@Module({
  imports: [PushSenderModule],
  providers: [RabbitMQConsumerService],
})
export class RabbitMQConsumerModule {}
