import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UserOutboxEvent } from '../users-outbox-events/entity/user-outbox-events.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async createUser(body: CreateUserDto): Promise<string> {
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const outboxRepo = manager.getRepository(UserOutboxEvent);

      // 1) insert user
      const user = userRepo.create({
        name: body.name,
        // ...any other fields
      });
      await userRepo.save(user);

      // 2) insert outbox (same trx)
      const outbox = outboxRepo.create({
        eventType: 'user.created',
        payload: { name: user.name, userId: user.id }, // JSONB in PG
        // createdAt will default in DB if you set default
      });
      await outboxRepo.save(outbox);
    });

    //create record in DB
    return 'User created!';
  }
}
