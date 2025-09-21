import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entity/user.entity';
import { UserOutboxEvent } from './users-outbox-events/entity/user-outbox-events.entity';
import { UsersOutboxEventModule } from './users-outbox-events/users-outbox-events.module';
import { ScheduleModule } from '@nestjs/schedule';

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
      entities: [User, UserOutboxEvent],
      synchronize: false, // dev only
    }),
    TypeOrmModule.forFeature([User, UserOutboxEvent]),
    UsersModule,
    UsersOutboxEventModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
