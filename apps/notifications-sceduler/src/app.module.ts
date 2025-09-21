import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledNotification } from './scheduler/entity/scheduled-notification.entity';
import { RabbitMQConsumerModule } from './consumer/rabbitmq-consumer.module';
import { NotificationsScedulerModule } from './scheduler/notifications-sceduler.module';
import { RabbitMQPublisherModule } from './publisher/rabbitmq-publisher.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: +(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASS ?? 'admin',
      database: process.env.DB_NAME ?? 'test-nebula',
      entities: [ScheduledNotification],
      synchronize: false, // dev only
    }),
    TypeOrmModule.forFeature([ScheduledNotification]),
    RabbitMQConsumerModule,
    NotificationsScedulerModule,
    RabbitMQPublisherModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
