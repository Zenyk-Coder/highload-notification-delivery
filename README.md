# Nebula Test Project

## Architecture overview

![Architecture](./architecture.jpg)

Services:

- users (NestJS, port 3000): REST API to create users. Persists to Postgres. Publishes domain events (outbox pattern) to RabbitMQ.
- notifications-sceduler (NestJS, port 3001): Consumes user events, schedules notifications in Postgres, periodic Cron picks due notifications and republishes to RabbitMQ.
- notifications-sender (NestJS, port 3002): Consumes scheduled notifications and sends push webhooks. Uses Redis for idempotency by messageId.
- Infrastructure: RabbitMQ (broker + management UI), Postgres (DB), Redis (cache).

Note on databases:

- Production: each microservice should have its own database (e.g., users_db, scheduler_db, sender_db).
- Local development: a single shared DB is acceptable to simplify setup (e.g., test_nebula).

---

## Prerequisites (local)

- Node.js 20+ and Yarn 1.x
  - macOS: `brew install node@20` and `npm i -g yarn@1`
- Postgres 15+
  - macOS: `brew install postgresql@15 && brew services start postgresql@15`
- RabbitMQ (with management UI)
  - macOS: `brew install rabbitmq && brew services start rabbitmq`
  - UI: http://localhost:15672 (default user/pass: guest/guest)
- Redis 7+
  - macOS: `brew install redis && brew services start redis`

Default local endpoints:

- Postgres: localhost:5432
- RabbitMQ AMQP: amqp://guest:guest@localhost:5672/
- RabbitMQ UI: http://localhost:15672
- Redis: redis://localhost:6379

---

## Install dependencies

```bash
yarn install
```

---

## Database setup

Choose one of the options below.

### Option A — single shared DB (simplest for local)

Create DB:

```bash
createdb test_nebula || true
```

Apply migrations:

```bash
# Users
psql -h localhost -p 5432 -U "$USER" -d test_nebula -f apps/users/migrations/1-create-user.sql
psql -h localhost -p 5432 -U "$USER" -d test_nebula -f apps/users/migrations/2-create-user-outbox-events.sql

# Notifications scheduler
psql -h localhost -p 5432 -U "$USER" -d test_nebula -f apps/notifications-sceduler/migrations/1-create-schedule-notifications.sql
```

### Option B — separate DBs per service (recommended for prod)

Create DBs:

```bash
createdb users_db || true
createdb scheduler_db || true
createdb sender_db || true
```

Apply migrations:

```bash
# users service
psql -h localhost -p 5432 -U "$USER" -d users_db -f apps/users/migrations/1-create-user.sql
psql -h localhost -p 5432 -U "$USER" -d users_db -f apps/users/migrations/2-create-user-outbox-events.sql

# notifications-sceduler service
psql -h localhost -p 5432 -U "$USER" -d scheduler_db -f apps/notifications-sceduler/migrations/1-create-schedule-notifications.sql
```

---

## Configure environment

Create .env files for each app (adjust ports/names if you use per-service DBs).

- apps/users/.env

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_nebula        # or users_db
DB_USER=$USER
DB_PASSWORD=
AMQP_URL=amqp://guest:guest@localhost:5672/
EXCHANGE=events
OUTBOX_BATCH=500
PORT=3000
```

- apps/notifications-sceduler/.env

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_nebula        # or scheduler_db
DB_USER=$USER
DB_PASSWORD=
AMQP_URL=amqp://guest:guest@localhost:5672/
EXCHANGE=events
QUEUE=user-events
ROUTING_KEY=user.created
PREFETCH=50
SCHEDULE_BATCH=500
PORT=3001
```

- apps/notifications-sender/.env

```bash
AMQP_URL=amqp://guest:guest@localhost:5672/
EXCHANGE=events
QUEUE=notifications
PREFETCH=50
REDIS_URL=redis://localhost:6379
IDEMPOTENCY_TTL=10800
# Optional external webhook sink for testing:
# PUSH_SINK_URL=https://httpbin.org/post
PORT=3002
```

---

## Run services (locally)

Open three terminals and run:

```bash
yarn start:users:dev
yarn start:notifications-scheduler:dev   # project name is "notifications-sceduler"
yarn start:notifications-sender:dev
```

Default ports:

- Users: http://localhost:3000
- Scheduler: http://localhost:3001
- Sender: http://localhost:3002

---

## Smoke test

```bash
curl -X POST http://localhost:3000/users \
  -H 'content-type: application/json' \
  -d '{"name":"Alice"}'
```

You should see:

- HTTP 201 from the users service.
- A user.created event in RabbitMQ (UI at http://localhost:15672).
- The scheduler creating a scheduled notification row.
- The worker publishing due notifications.
- The sender posting to PUSH_SINK_URL (or logging a sent event).

---

## Load testing (optional)

Artillery script is provided to send POST /users at 15 rps:

```bash
npx artillery run load-test.yml
```

Tip: If your API requires unique names, update the body to include a suffix (e.g., {{ $timestamp }}).

---

## RabbitMQ topology

- Exchange: events (topic)
- users publishes events (e.g., user.created).
- notifications-sceduler binds queue user-events to events:user.created.
- Cron worker republishes due notifications to events:<notification_type>.
- notifications-sender consumes queue notifications and sends webhooks (idempotent via Redis).

---

## Troubleshooting

- Cannot connect to Postgres:
  - Ensure Postgres is running: `pg_isready -h localhost -p 5432`
  - Verify DB_NAME/DB_USER/DB_PASSWORD in .env.
- RabbitMQ connection errors:
  - Start RabbitMQ and check UI at http://localhost:15672.
  - Verify AMQP_URL in .env is amqp://guest:guest@localhost:5672/.
- Redis/idempotency:
  - Ensure Redis is running: `redis-cli PING` → PONG.
- “Cannot find dist/apps/<app>/main.js”:
  - Run `yarn build`, or run dev scripts which compile on the fly.
  - Check per-app tsconfig.app.json outDir and project names in nest-cli.json.
- Cron didn’t fire:
  - Ensure @nestjs/schedule is installed and ScheduleModule.forRoot() is imported in the scheduler app.
  - Watch logs for “Scheduler tick start”.
