# CAF Flutter Mobile App - Current Design & Implementation Status

**Document version:** 2.0  
**Date:** February 25, 2026  
**Scope:** Actual implemented Flutter client app (client-facing) + backend contracts used by the app.

---

## 1. What Is Implemented Now

The current Flutter mobile app is a **client-only portal** (not an admin-portal clone). It is designed for production-oriented client access to CAF services and works with the Go API's `/api/v1/client` route group.

### Implemented Client Sections

- `Dashboard` (minimalist summary)
- `Notificaciones`
- `Mi Caso`
- `Citas`
- `Pagos` (Stripe hosted Checkout)
- `Recibos` (Stripe receipts listing)
- `Contacto`

### Implemented Realtime Behavior

- WebSocket notifications (`/ws?token=<jwt>`) refresh notifications and case/appointment views in the app.
- Staff/admin `client_visible` case comments reach the client in realtime.
- Client replies in `Mi Caso` notify portal users (admins/managers/assigned staff) via DB notifications + websocket payloads.
- Stripe webhook-confirmed payments notify the client and refresh `Recibos` in realtime.

---

## 2. Actual Flutter Architecture (Current)

The mobile app intentionally uses a compact architecture (not full Clean Architecture/BLoC yet) to ship a stable client portal quickly.

```text
client-app/lib/
├── main.dart
└── src/
    ├── app_state.dart   # AppConfig, ApiClient, secure token storage, realtime, domain models, app state
    ├── auth_pages.dart  # Login/register screens
    └── app_shell.dart   # Navigation shell + all client sections
```

### Core Design Choices

- **Provider + ChangeNotifier** for app-wide state (`AppState`)
- **Centralized HTTP client** with JWT header injection
- **Secure token storage** via `flutter_secure_storage`
- **Hosted Stripe Checkout** (no secret key in app)
- **Server-enforced access control** via `/api/v1/client`

---

## 3. Backend Contracts Used by the App

### Auth (Public)

- `POST /api/v1/login`
- `POST /api/v1/register` (app sends `role=client`)

### Client Portal (`/api/v1/client`)

- `GET /profile`
- `GET /cases`
- `GET /cases/:id`
- `POST /cases/:id/comments`
- `GET /appointments`
- `GET /notifications`
- `POST /notifications/mark-read`
- `GET /payments/receipts`
- `POST /payments/checkout-session`
- `GET /offices`
- `GET /documents/:eventId`

### Realtime

- `GET /ws?token=<jwt>`

---

## 4. Stripe Payment Design (Implemented)

### Security Model

- Stripe secret key is stored only on the Go API server (`STRIPE_SECRET_KEY`)
- Flutter app requests a server-created Checkout Session URL
- App opens Stripe hosted Checkout in the system browser (`url_launcher`)
- Receipts are fetched from the API (which queries Stripe) and displayed in the app
- App handles success/cancel return URLs (deep-link or portal URL) and refreshes receipts on app resume

### Backend Requirements

- `STRIPE_SECRET_KEY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY` (optional, default `mxn`)

### Data Support

- `users.stripe_customer_id` (DB migration `0057_users_stripe_customer_id.sql`)
- `payment_records` (DB migration `0058_create_payment_records.sql`) for webhook-backed payment state tracking

---

## 5. Why This Differs From the Original Proposal

The previous version of this document described a future full-featured, multi-role Flutter application with large-scale parity to the admin portal.

That is **not** what is currently implemented.

The current codebase now reflects a more pragmatic, production-focused first release:

- client-only mobile app
- secure access to client data only
- realtime notifications and case messaging
- Stripe hosted Checkout + receipts
- clear expansion path without blocking release

---

## 6. Recommended Next Steps (Roadmap)

### Near-Term (Production Hardening)

1. Add push notifications (FCM/APNs) in addition to websocket notifications.
2. Add platform-level deep link / universal link config in this repo when `android/` and `ios/` folders are added.
3. Add richer payment reconciliation states (refund disputes, chargebacks, settlement exports) if accounting requires it.

### Product Enhancements

1. Client document upload (if desired) with server-side moderation rules.
2. Appointment confirmations/rescheduling flows for client role.
3. Rich case chat UX (typing, attachments, read markers) if required.
4. Native Stripe SDK (`flutter_stripe`) if you prefer in-app payment sheet over hosted Checkout.

---

## 7. Developer Runbook (Mobile)

```bash
cd client-app
flutter pub get
flutter analyze
flutter run --dart-define=CAF_API_BASE_URL=http://localhost:8080/api/v1 --dart-define=CAF_WS_BASE_URL=ws://localhost:8080/ws
```

If `CAF_WS_BASE_URL` is omitted, the app derives `/ws` from `CAF_API_BASE_URL` automatically.

For Checkout return deep-links, you can also provide:

- `CAF_PAYMENT_RETURN_SCHEME` (default `cafclient`)
- `CAF_PAYMENT_RETURN_HOSTS` (default includes `caf-mexico.org` / `www.caf-mexico.org` / `caf-mexico.com` / `www.caf-mexico.com`, plus optional portal domains)
