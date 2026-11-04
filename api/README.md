# CAF API (Go Backend)

Go backend for the CAF platform. It serves the admin portal, marketing site integrations, and the Flutter **client mobile app**.

## What It Provides

- JWT authentication (`/api/v1/login`); accounts are provisioned by authorized administrators
- Role-aware route groups (`/api/v1`, `/api/v1/admin`, `/api/v1/staff`, `/api/v1/manager`)
- Client-safe mobile route group (`/api/v1/client`)
- Case management, client appointments, internal employee calendar, tasks, documents, notifications
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

- `POST /login`
- `POST /api/v1/webhooks/stripe` (Stripe signed webhook endpoint)
- Public marketing endpoints (`/public/*`)

### Realtime

- `GET /ws` with WebSocket subprotocol `caf.jwt.<jwt>`
  - Per-user websocket notifications
  - Payload shape (server -> client): `{ type: "notification", notification: {...} }`

### Protected Staff/Admin (`/api/v1`)

- Protected group for authenticated non-client users (`DenyClients` middleware)
- Dashboard, cases, appointments, internal calendar, tasks, documents, notifications, profile, etc.

Internal calendar endpoints (all authenticated non-client employees):

- `GET /calendar/staff` - minimal active employee directory for invitations
- `GET /calendar/events?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` - meetings organized by or addressed to the current employee
- `POST /calendar/events` - create a meeting and attendee invitations
- `PATCH /calendar/events/:id` - organizer/admin update
- `PATCH /calendar/events/:id/response` - attendee response (`accepted`, `tentative`, `declined`)
- `DELETE /calendar/events/:id` - organizer/admin cancellation (soft delete)

Internal meetings are intentionally stored separately from case appointments. Event visibility is participant-scoped, attendee IDs are validated against active non-client accounts, and invite/update/cancellation notifications link back to `/app/calendar`.

All non-client employee roles may create cases and client appointments through their role route group. Non-admin creation is office-scoped: submitted office IDs cannot escape the authenticated employee's office, target staff must belong to that office, and newly created staff cases are assigned to their creator.

Appointment scheduling availability:

- `GET /appointment-availability?staffId=<id>&from=<RFC3339>&to=<RFC3339>` returns `{staffId,busy:[{startTime,endTime}]}` for a range of at most 45 days. Administrators may query any active employee; other employees may query only their own office. No appointment titles, clients, or meeting details are returned.
- Busy intervals include non-cancelled, non-deleted appointments and internal meetings organized by the employee or invitations that have not been declined. Overlap uses half-open intervals, permitting back-to-back appointments.
- The portal's smart creation routes accept an optional IANA `timeZone` and enforce future appointments within Monday–Friday 09:00–18:00. Without `timeZone`, the supplied start-time offset is used for compatibility.
- Smart creation locks the assigned employee row and rechecks commitments inside the creation transaction, returning `409` if occupied before creating clients/cases. This serializes concurrent smart appointment creations for that employee. Other scheduling writers (legacy edits and internal meeting writes) do not acquire this lock; availability is a snapshot, not a reservation across those workflows.
- Deploy the API together with the portal; no database migration is needed.

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
- `STRIPE_CHECKOUT_SUCCESS_URL=https://www.caf-mexico.com/pagos/exito`
- `STRIPE_CHECKOUT_CANCEL_URL=https://www.caf-mexico.com/pagos/cancelado`

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
- Local filesystem fallback when S3 is unavailable. In the production stack,
  `/app/uploads` is mounted to the `caf_uploads` Docker volume, so profile
  pictures and documents survive API container replacement and redeployment.

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
