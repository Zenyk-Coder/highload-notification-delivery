import { Module } from '@nestjs/common';
import { RabbitPublisher } from './rabbitmq-publisher.service';
import { UserOutboxEventService } from './user-outbox-events.service';

@Module({
  imports: [],
  controllers: [],
  providers: [RabbitPublisher, UserOutboxEventService],
})
export class UsersOutboxEventModule {}
