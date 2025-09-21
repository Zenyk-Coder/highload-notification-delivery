import { Module } from '@nestjs/common';
import { RabbitMQConsumerModule } from './consumer/rabbitmq-consumer.module';
import { PushSenderModule } from './push-sender/push-sender.module';

@Module({
  imports: [RabbitMQConsumerModule, PushSenderModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
