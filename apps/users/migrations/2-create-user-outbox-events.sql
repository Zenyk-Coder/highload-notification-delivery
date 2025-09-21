CREATE TABLE user_outbox_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  TEXT        NOT NULL,      -- напр. 'user.created'
    payload     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- down
DROP TABLE IF EXISTS user_outbox_events;
