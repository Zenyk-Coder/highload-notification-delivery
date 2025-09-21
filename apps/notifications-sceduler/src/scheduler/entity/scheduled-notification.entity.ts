import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'scheduled_notifications' })
export class ScheduledNotification {
  // BIGSERIAL -> bigint; use string in TS to avoid precision issues
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Column({ name: 'scheduled_for', type: 'timestamptz' })
  scheduledFor: Date;

  @Column({ name: 'notification_type', type: 'text' })
  notificationType: string;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'idempotency_key' })
  idempotencyKey!: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;
}
