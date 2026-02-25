# CAF API (Go Backend)

Go backend for the CAF platform. It serves the admin portal, marketing site integrations, and the Flutter **client mobile app**.

## What It Provides

- JWT authentication (`/api/v1/login`, `/api/v1/register`)
- Role-aware route groups (`/api/v1`, `/api/v1/admin`, `/api/v1/staff`, `/api/v1/manager`)
- Client-safe mobile route group (`/api/v1/client`)
- Case management, appointments, tasks, documents, notifications
- Realtime notification websocket endpoint (`/ws`)
- Profile avatar upload/storage (S3 or local fallback)
- Hosted Stripe Checkout session creation + Stripe receipts listing for clients

## Architecture (High Level)

```text
api/
├── cmd/server/main.go        # Server bootstrap, middleware, route registration
├── handlers/                 # HTTP handlers (auth, cases, appointments, client portal, payments, etc.)
├── middleware/               # JWT auth, RBAC, data access control, validation, rate limiting
├── models/                   # GORM models
├── repositories/             # Data access abstractions
├── services/                 # Business/domain services
├── storage/                  # S3/local storage strategy
├── db/migrations/            # SQL migrations
└── config/                   # Environment configuration
```

## Route Groups

### Public (`/api/v1`)

- `POST /register`
- `POST /login`
- `POST /webhooks/stripe` (Stripe signed webhook endpoint)
- Public marketing endpoints (`/public/*`)

### Realtime

- `GET /ws?token=<jwt>`
  - Per-user websocket notifications
  - Payload shape (server -> client): `{ type: "notification", notification: {...} }`

### Protected Staff/Admin (`/api/v1`)

- Protected group for authenticated non-client users (`DenyClients` middleware)
- Dashboard, cases, appointments, tasks, documents, notifications, profile, etc.

### Client Mobile Portal (`/api/v1/client`)  [NEW]

Client-safe endpoints for the Flutter app:

- `GET /profile`
- `PATCH /profile`
- `POST /profile/avatar`
- `GET /avatar`
- `GET /cases`
- `GET /cases/my`
- `GET /cases/:id` (ownership enforced, only client-visible case events)
- `POST /cases/:id/comments` (client reply in case timeline)
- `GET /appointments` (ownership enforced via case join)
- `GET /notifications`
- `POST /notifications/mark-read`
- `GET /payments/receipts` (Stripe charges/receipts for authenticated client)
- `POST /payments/checkout-session` (Stripe hosted Checkout URL for case fee)
- `GET /documents/:eventId` (visibility + ownership enforced)
- `GET /offices`

### Admin / Staff / Manager

- Existing role-specific route groups remain in place:
  - `/api/v1/admin`
  - `/api/v1/staff`
  - `/api/v1/manager`

## Realtime Messaging Consistency (Cases)

- Staff/admin `client_visible` comments now:
  - create DB notifications for the client
  - push websocket notifications to the client in realtime
- Client case replies (`POST /api/v1/client/cases/:id/comments`) now:
  - create timeline events (`client_visible`)
  - notify portal users (admins, office managers, primary/assigned staff)
  - push websocket notifications to those users

## Stripe Integration (Server-Side, Secure)

The API creates hosted Stripe Checkout Sessions and lists receipts (charges) for the authenticated client. No secret Stripe keys are exposed to mobile/web clients.

Recommended for the current CAF architecture (no separate client web portal):
- `STRIPE_CHECKOUT_SUCCESS_URL=https://caf-mexico.org/pagos/exito`
- `STRIPE_CHECKOUT_CANCEL_URL=https://caf-mexico.org/pagos/cancelado`

### Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_WEBHOOK_SECRET`

### Optional

- `STRIPE_CURRENCY` (default `mxn`)
- `STRIPE_PUBLISHABLE_KEY` (not required for hosted Checkout flow, but may be useful for future clients)
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (optional; default `300`)

### Data Model Support

- `users.stripe_customer_id` (migration `0057_users_stripe_customer_id.sql`)
- `payment_records` (migration `0058_create_payment_records.sql`) for webhook-backed payment tracking

### Webhook Behavior (Implemented)

- Verifies Stripe signature using `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET`
- Persists Checkout payment state (`payment_records`) from `checkout.session.*` events
- Creates client-visible case timeline payment confirmation events (deduplicated by Checkout Session ID)
- Notifies client + portal users (admins/office managers/assigned staff) via DB notifications + `/ws`
- Admin financial dashboard metrics now read revenue from `payment_records` (webhook-backed)

## Storage

Document/avatar storage uses a strategy pattern:

- S3 (`AWS_*`, `S3_BUCKET`) when configured
- Local filesystem fallback when S3 is unavailable

## Environment Configuration

Use one of the included examples and copy to `api/.env`:

- `api/.env.example`
- `api/env.example`

Core variables include:

- DB: `DB_*`
- Auth: `JWT_SECRET`
- CORS: `CORS_ALLOWED_ORIGINS`
- Rate limits: `RATE_LIMIT_*`
- Storage: `AWS_*`, `S3_BUCKET`, `UPLOADS_DIR`
- Stripe: `STRIPE_*`

## Run Locally

```bash
cd api
go mod download
cp .env.example .env   # or customize env.example
go run ./cmd/server/main.go
```

Health checks:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /health/storage`
- `GET /health/migrations`

## Tests

```bash
cd api
go test ./...
```

If your environment restricts the default Go cache path, you can use a workspace-local cache:

```bash
mkdir -p .gocache
GOCACHE=$(pwd)/.gocache go test ./...
```
