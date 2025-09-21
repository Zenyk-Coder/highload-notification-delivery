-- одна табличка: що і коли штовхнути в чергу
CREATE TABLE scheduled_notifications (
  id           BIGSERIAL PRIMARY KEY,
  scheduled_for TIMESTAMPTZ NOT NULL,   -- коли запускати
  notification_type  TEXT        NOT NULL,      -- напр. 'notification.push'
  user_id     BIGINT NOT NULL,         -- кому відправляти
  idempotency_key TEXT NOT NULL, -- щоб не відправити двічі
  payload      JSONB NOT NULL,         -- що саме відправляти (userId, template, meta)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- покриває WHERE scheduled_for <= now()
-- і ORDER BY scheduled_for, id LIMIT N (для FOR UPDATE SKIP LOCKED)
CREATE INDEX ix_scheduled_notifications_due
  ON scheduled_notifications (scheduled_for, id);

CREATE UNIQUE INDEX uq_sched_idem
  ON scheduled_notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP TABLE IF EXISTS scheduled_notifications;