# CAF Client App (Flutter)

Flutter mobile app for **CAF clients** (not staff/admin). It consumes the CAF Go API and the new client-safe route group under `/api/v1/client`.

## Current Scope (Implemented)

- Authentication (login only; client account is provisioned by CAF)
- Minimalist dashboard
- Notificaciones (list + mark read)
- Mi Caso (client-safe case detail)
- Case timeline messaging (client replies to CAF team)
- Citas (client appointments)
- Pagos + Recibos (server-created Stripe Checkout session + receipts list)
- Stripe Checkout return handling (deep-link + app resume refresh)
- Contacto (office + assigned staff contact info when available)
- Realtime refresh via WebSocket notifications (`/ws`)

## Architecture (Current)

The app uses a lightweight, production-oriented Flutter architecture with `provider` and a centralized state object.

```text
lib/
├── main.dart              # App bootstrap + provider + auth gate
└── src/
    ├── app_state.dart     # Config, API client, secure token storage, realtime, app state
    ├── auth_pages.dart    # Login-only UX (CAF-provisioned accounts)
    └── app_shell.dart     # Section shell (Dashboard, Notificaciones, Mi Caso, Citas, Pagos, Contacto)
```

## Security Notes

- JWT is stored using `flutter_secure_storage`.
- API requests include `Authorization: Bearer <token>`.
- Stripe secret keys are **never** stored in the app.
- The app only requests a hosted Stripe Checkout URL from the API and opens it externally.
- Payment completion truth comes from server-side Stripe webhooks; the app only reacts to return URLs and refreshed receipts.

## API Contracts Used

Primary client endpoints:

- `POST /api/v1/login`
- `GET /api/v1/client/profile`
- `GET /api/v1/client/cases`
- `GET /api/v1/client/cases/:id`
- `POST /api/v1/client/cases/:id/comments`
- `GET /api/v1/client/appointments`
- `GET /api/v1/client/notifications`
- `POST /api/v1/client/notifications/mark-read`
- `GET /api/v1/client/payments/receipts`
- `POST /api/v1/client/payments/checkout-session`
- `GET /api/v1/client/offices`
- `GET /ws` with WebSocket subprotocol `caf.jwt.<jwt>` (realtime notifications)

## Configuration

This app uses `--dart-define` instead of a `.env` file.

Required (or use default):

- `CAF_API_BASE_URL` (default: `https://api.caf-mexico.com/api/v1`)

Optional:

- `CAF_WS_BASE_URL` (if omitted, the app derives `/ws` from `CAF_API_BASE_URL`)
- `CAF_PAYMENT_RETURN_SCHEME` (default: `cafclient`)
- `CAF_PAYMENT_RETURN_HOSTS` (default includes marketing + portal domains)

### Example (Development)

```bash
flutter run \
  --dart-define=CAF_API_BASE_URL=http://localhost:8080/api/v1 \
  --dart-define=CAF_WS_BASE_URL=ws://localhost:8080/ws \
  --dart-define=CAF_PAYMENT_RETURN_SCHEME=cafclient
```

### Example (Production)

```bash
flutter run \
  --dart-define=CAF_API_BASE_URL=https://api.caf-mexico.com/api/v1
```

## Stripe (Hosted Checkout)

The mobile app does not embed card processing directly. Instead:

1. Client taps `Pagar` on a case with `fee > 0`
2. App calls `POST /api/v1/client/payments/checkout-session`
3. API creates a Stripe Checkout Session with the server-side secret key
4. App opens Stripe Checkout URL in the system browser
5. Stripe redirects to your configured success/cancel URL (web/portal page or app link)
6. App handles deep-link/app resume and refreshes receipts from `GET /api/v1/client/payments/receipts`

Server-side env vars required in the API:

- `STRIPE_SECRET_KEY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_WEBHOOK_SECRET` (required for server-side payment confirmation tracking)
- `STRIPE_CURRENCY` (optional, default `mxn`)

## Realtime Messaging Behavior

- When CAF staff/admin posts a `client_visible` case comment, the client app receives a websocket notification and refreshes notifications/case detail.
- When the client replies via `Mi Caso`, the API stores a case event and notifies portal users (admins/managers/assigned staff) via notifications + websocket payloads.
- When CAF confirms a Stripe payment via webhook, the app receives a payment notification and refreshes receipts automatically.

## Deep-Link Return Setup (Important)

The app listens for Stripe return URLs and routes the user back to `Pagos/Recibos`.

- Supported by default:
  - `https://www.caf-mexico.com/pagos/exito`
  - `https://www.caf-mexico.com/pagos/cancelado`
  - `https://caf-mexico.com/pagos/exito`
  - `https://caf-mexico.com/pagos/cancelado`
  - `https://www.caf-mexico.org/pagos/exito` (legacy redirect-compatible)
  - `https://www.caf-mexico.org/pagos/cancelado` (legacy redirect-compatible)
  - `https://caf-mexico.org/pagos/exito` (legacy redirect-compatible)
  - `https://caf-mexico.org/pagos/cancelado` (legacy redirect-compatible)
  - `cafclient://payments/success`
  - `cafclient://payments/cancel`
- The API also appends helpful query params (`checkout`, `status`, `case_id`, `session_id`) to Checkout return URLs.

### Platform Configuration

Both `android/` and `ios/` are versioned in this repository.

- Android already has an `intent-filter` for `cafclient://payments`.
- iOS already registers the `cafclient` URL scheme.
- HTTPS App Links / Universal Links still require platform and domain association
  configuration; recognizing a URL in Dart does not establish native routing.
- Your marketing success/cancel pages can redirect to the app scheme for a direct mobile return UX.

## Release readiness (reviewed November 22, 2026)

This is an implemented client portal, not a staff/admin mobile application.
`flutter analyze --no-pub` passes. This review did not build or distribute a
signed Android/iOS release or verify behavior on physical devices.

Before a pilot or store release:

- Replace the template Android application ID and iOS bundle identifier
  (`com.example.*`) with CAF-owned identifiers and configure release signing.
  Android currently uses the debug signing configuration for release builds;
  the iOS project has no versioned development-team setting.
- Add Internet permission to the Android main/release manifest. It is currently
  present only in the debug/profile manifests.
- Validate production HTTPS configuration, secure-storage/session behavior,
  document downloads and checkout return/webhook reconciliation on both platforms.
- Add meaningful Flutter widget/integration coverage and physical-device QA.
  No Dart test suite is versioned; the native iOS test is a template placeholder.
- Complete store account setup, metadata, privacy disclosures and beta distribution.
- Add FCM/APNs if background push delivery is part of the release scope. Current
  notifications use WebSockets and are not a substitute for background push.

Release references: [Flutter Android deployment](https://docs.flutter.dev/deployment/android)
and [Flutter iOS deployment](https://docs.flutter.dev/deployment/ios).

## Development Commands

```bash
cd client-app
flutter pub get
flutter analyze
flutter run --dart-define=CAF_API_BASE_URL=http://localhost:8080/api/v1 --dart-define=CAF_WS_BASE_URL=ws://localhost:8080/ws --dart-define=CAF_PAYMENT_RETURN_SCHEME=cafclient
```

## Notes

- Legacy prototype files (`lib/screens/*`, `lib/services/auth_service.dart`) were removed in favor of the centralized `lib/src/*` implementation.
- Self-service account creation is intentionally not exposed in the mobile app; client accounts are created by CAF staff/admins.
- If Stripe is not configured on the API, `Pagos` stays visible but shows a clear configuration message instead of failing silently.
- If a user returns from Checkout before the webhook completes, the app may briefly show stale receipts until the webhook updates the server (then websocket/app refresh catches up).
