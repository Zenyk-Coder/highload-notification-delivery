import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'user_outbox_events' })
export class UserOutboxEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Column({ type: 'text', name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb', name: 'payload' })
  payload: Record<string, any>;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
    default: () => 'now()',
  })
  createdAt: Date;
}
