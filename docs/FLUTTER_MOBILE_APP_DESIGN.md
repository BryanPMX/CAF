# CAF Flutter Mobile App — Design & Architecture

**Document version:** 1.0  
**Date:** February 2025  
**Purpose:** Proposed design and file architecture for translating the CAF admin-portal to a Flutter-based cross-platform mobile application, following SOLID principles, OOP practices, and established design patterns. Includes a new client payment feature (Stripe) for appointments and charges.

---

## 1. Executive Summary

This document defines how to build a **cross-platform mobile app (iOS & Android)** that replicates all functionalities of the existing **admin-portal** (Next.js), reusing the same CAF Go API. The app will support **admin**, **office_manager**, **staff** (lawyer, psychologist, receptionist, event_coordinator), and **client** roles with role-based navigation and API routing. A new **client payment** flow will allow clients to pay for appointments or current charges via **Stripe**.

---

## 2. Admin-Portal Analysis Summary

### 2.1 Technology Stack (Current)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Ant Design |
| Auth | JWT (Bearer), Cookies + localStorage, jwt-decode |
| HTTP | Axios, role-based base paths (`/api/v1`, `/api/v1/admin`, `/api/v1/staff`, `/api/v1/manager`) |
| State | React Context (Auth, Notifications), local component state |
| Realtime | WebSocket (`/ws`) for notifications |

### 2.2 Feature Inventory (Admin-Portal)

| Feature Area | Description | Key API Groups | Roles |
|-------------|-------------|---------------|--------|
| **Authentication** | Login, JWT, profile, avatar | `POST /login`, `GET/PATCH /profile`, `POST /profile/avatar` | All |
| **Dashboard** | Summary stats, recent activity, announcements, notes, charts | `GET /dashboard-summary`, `GET /staff/dashboard-summary`, `GET /dashboard/announcements`, `GET /dashboard/notes`, `GET /admin/dashboard/stats`, `GET /admin/dashboard/activity` | All (role-scoped) |
| **Cases** | CRUD, list/detail, stages, assign staff, complete, archive, tasks, comments, documents | `GET/POST/PUT/DELETE /cases`, `PATCH /cases/:id/stage`, `POST /cases/:id/assign`, `POST /cases/:id/complete`, tasks & case events | Admin, Manager, Staff (data access control) |
| **Appointments** | CRUD, calendar view, filters, categories/departments | `GET/POST/PATCH/DELETE /appointments`, optimized admin list | Admin, Manager, Staff |
| **Users** | CRUD, search clients, list by office | `GET/POST/PATCH/DELETE /admin|manager/users`, `GET /admin/users/search` | Admin, Manager (staff read-only in some flows) |
| **Offices** | CRUD, detail with staff | `GET/POST/PATCH/DELETE /admin/offices`, `GET /offices/:id/detail` | Admin; Manager/Staff read |
| **Tasks** | CRUD, comments, my tasks | `GET/POST/PUT/DELETE /tasks`, task comments | Admin, Manager, Staff |
| **Notifications** | List, mark read, realtime bell | `GET /notifications`, `POST /notifications/mark-read`, WebSocket | All |
| **Records (Archive)** | Archived cases/appointments, restore, permanent delete | `GET /records/*`, restore, permanent delete | Admin, Manager |
| **Reports** | Summary, cases, appointments, export | `GET /admin|manager/reports/*`, export | Admin, Manager |
| **Files / Documents** | Upload/download case documents, preview | `GET /documents/:eventId`, case document upload/update/delete | All (permission-scoped) |
| **Web Content (CMS)** | Site content, services, events, images | `GET/POST/PATCH/DELETE /admin/site-*` | Admin only |
| **Profile** | View/edit profile, avatar | `GET/PATCH /profile`, avatar upload | All |
| **Contact submissions** | List contact form submissions | `GET /admin/contact-submissions` | Admin |

### 2.3 Role-Based Access (from admin-portal)

- **admin:** Full access; admin routes; dashboard stats; CMS; contact submissions; optimized list endpoints.
- **office_manager:** Manager routes; users (create/update scoped); offices read; cases, appointments, tasks, records, reports (scoped by data access control).
- **staff (lawyer, psychologist, receptionist, event_coordinator):** Staff/protected routes; cases, appointments, tasks (access control); no user management; no CMS.
- **client:** Blocked from staff/admin APIs by middleware (`DenyClients`); future: client portal (e.g. view own cases/appointments + **pay**).

### 2.4 Key Data Models (API)

- **User** (role, officeId, department, specialty, avatar, isActive).
- **Case** (clientId, officeId, status, currentStage, category, priority, fee, isCompleted, isArchived, case events, tasks, appointments).
- **Appointment** (caseId, staffId, officeId, startTime, endTime, status, category, department).
- **Task** (caseId, assignedToId, status, priority, dueDate, comments).
- **Office**, **CaseEvent** (comments/documents), **Notification**, **Announcement**, **UserNote**, **SiteContent**, etc.

The backend already exposes **revenue/outstanding invoices** placeholders in admin dashboard stats; **Case.Fee** exists. No Stripe/payment implementation exists yet.

---

## 3. Design Principles & Patterns

### 3.1 SOLID Applied

| Principle | Application in Flutter App |
|-----------|----------------------------|
| **S**ingle Responsibility | One class/object per concern: e.g. `AuthRepository` (auth only), `CaseRepository` (case API only), `PaymentRepository` (payments only). Widgets either present or delegate to blocs/repositories. |
| **O**pen/Closed | Extend via new repositories, use cases, and screens without modifying existing ones. Role-based feature modules and navigation built on abstractions (e.g. `ApiClient`, `PaymentService`). |
| **L**iskov Substitution | All HTTP clients implement a common `HttpClient` interface; all repositories implement domain-specific repository interfaces so tests and implementations can be swapped. |
| **I**nterface Segregation | Small interfaces: `AuthRepository`, `CaseRepository`, `AppointmentRepository`, `PaymentRepository`, `NotificationRepository`, etc. No “god” repository. |
| **D**ependency Inversion | Depend on abstractions (interfaces): repositories and use cases depend on `HttpClient`, `SecureStorage`, `PaymentService`; UI depends on BLoC/Cubit or ViewModel, not concrete API. |

### 3.2 OOP Practices

- **Domain entities:** Immutable (or copy-with) model classes in `lib/domain/entities/` (e.g. `User`, `Case`, `Appointment`, `Charge`, `PaymentIntent`).
- **DTOs:** Separate request/response DTOs in `lib/data/models/` for API mapping (e.g. `UserDto`, `CaseDto`), with `fromJson` / `toJson` and mappers to entities.
- **Repositories:** One per aggregate; encapsulate API calls and map DTOs → entities; throw domain-friendly exceptions.
- **Use cases:** One use case per user action (e.g. `LoginUseCase`, `GetCasesUseCase`, `CreatePaymentIntentUseCase`). Use cases call repositories and optionally coordinate multiple repositories.
- **Dependency injection:** Use `get_it` + `injectable` (or manual registration) so repositories and use cases are injectable and testable.

### 3.3 Design Patterns

| Pattern | Usage |
|---------|--------|
| **Repository** | Abstract data sources (API) per domain; used by use cases. |
| **Use Case / Interactor** | Encapsulate business rules and orchestrate repositories. |
| **BLoC / Cubit** | State management for screens; input events → use cases → states → UI. |
| **Strategy** | Role-based API base path selection (admin vs manager vs staff vs client). |
| **Factory** | Build API clients or repository instances by role/environment. |
| **Observer** | Streams for realtime notifications (WebSocket → BLoC). |
| **Adapter** | HTTP client adapter (Dio), secure storage adapter (flutter_secure_storage), Stripe SDK adapter. |
| **Singleton** | Service locator (get_it) for app-wide dependencies. |
| **Decorator** | Interceptors: auth token, logging, error mapping. |

---

## 4. Proposed File & Folder Architecture

```
caf_mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   │
│   ├── core/                          # Shared kernel
│   │   ├── config/
│   │   │   ├── env_config.dart         # Base URL, Stripe publishable key, feature flags
│   │   │   ├── api_endpoints.dart      # Path constants (mirrors admin-portal api-endpoints)
│   │   │   └── role_config.dart        # Role hierarchy, permissions, nav items (from roles.ts)
│   │   ├── network/
│   │   │   ├── api_client.dart         # Abstract HTTP client interface
│   │   │   ├── dio_client.dart        # Dio implementation + interceptors (auth, errors)
│   │   │   ├── endpoint_resolver.dart  # Role-based path prefix (admin/manager/staff)
│   │   │   └── api_exceptions.dart     # Unauthorized, validation, server errors
│   │   ├── storage/
│   │   │   ├── secure_storage.dart     # Abstract (token, refresh)
│   │   │   └── secure_storage_impl.dart
│   │   ├── auth/
│   │   │   ├── auth_interceptor.dart
│   │   │   └── token_refresh_handler.dart  # Optional refresh flow
│   │   ├── errors/
│   │   │   ├── failures.dart           # Domain failures
│   │   │   └── exceptions.dart
│   │   └── utils/
│   │       ├── logger.dart
│   │       └── validators.dart
│   │
│   ├── domain/                         # Business logic (entities + use cases)
│   │   ├── entities/
│   │   │   ├── user.dart
│   │   │   ├── case_entity.dart
│   │   │   ├── appointment.dart
│   │   │   ├── task.dart
│   │   │   ├── office.dart
│   │   │   ├── notification.dart
│   │   │   ├── charge.dart             # For payments: amount, description, type (appointment/case)
│   │   │   └── payment_intent_result.dart
│   │   ├── repositories/               # Abstract repository interfaces
│   │   │   ├── auth_repository.dart
│   │   │   ├── case_repository.dart
│   │   │   ├── appointment_repository.dart
│   │   │   ├── user_repository.dart
│   │   │   ├── office_repository.dart
│   │   │   ├── task_repository.dart
│   │   │   ├── notification_repository.dart
│   │   │   ├── record_repository.dart
│   │   │   ├── report_repository.dart
│   │   │   ├── document_repository.dart
│   │   │   ├── dashboard_repository.dart
│   │   │   ├── payment_repository.dart   # Stripe: create intent, confirm, list charges
│   │   │   └── site_content_repository.dart  # Admin CMS
│   │   └── use_cases/
│   │       ├── auth/
│   │       │   ├── login_use_case.dart
│   │       │   ├── logout_use_case.dart
│   │       │   └── get_profile_use_case.dart
│   │       ├── cases/
│   │       │   ├── get_cases_use_case.dart
│   │       │   ├── get_case_by_id_use_case.dart
│   │       │   ├── create_case_use_case.dart
│   │       │   ├── update_case_use_case.dart
│   │       │   ├── update_case_stage_use_case.dart
│   │       │   └── assign_staff_use_case.dart
│   │       ├── appointments/
│   │       │   ├── get_appointments_use_case.dart
│   │       │   ├── create_appointment_use_case.dart
│   │       │   └── update_appointment_use_case.dart
│   │       ├── payments/
│   │       │   ├── get_charges_for_client_use_case.dart
│   │       │   ├── create_payment_intent_use_case.dart
│   │       │   └── confirm_payment_use_case.dart
│   │       └── ... (other domains)
│   │
│   ├── data/                           # Data layer
│   │   ├── models/                     # DTOs + fromJson/toJson
│   │   │   ├── user_dto.dart
│   │   │   ├── case_dto.dart
│   │   │   ├── appointment_dto.dart
│   │   │   ├── charge_dto.dart
│   │   │   └── payment_intent_dto.dart
│   │   ├── repositories/
│   │   │   ├── auth_repository_impl.dart
│   │   │   ├── case_repository_impl.dart
│   │   │   ├── appointment_repository_impl.dart
│   │   │   ├── payment_repository_impl.dart
│   │   │   └── ...
│   │   └── remote/
│   │       └── websocket_client.dart    # Notifications WebSocket
│   │
│   ├── di/                             # Dependency injection
│   │   ├── injection.dart              # get_it + register all
│   │   └── module_registry.dart        # Optional: per-feature modules
│   │
│   ├── presentation/                   # UI layer
│   │   ├── app_router.dart             # GoRouter / AutoRoute: auth guard, role-based routes
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   └── app_colors.dart
│   │   ├── shared/
│   │   │   ├── widgets/                # Reusable UI (buttons, cards, loading, error)
│   │   │   ├── mixins/
│   │   │   └── extensions/
│   │   ├── auth/
│   │   │   ├── bloc/
│   │   │   │   ├── auth_bloc.dart
│   │   │   │   └── auth_state.dart
│   │   │   ├── screens/
│   │   │   │   ├── login_screen.dart
│   │   │   │   └── splash_screen.dart
│   │   │   └── widgets/
│   │   ├── dashboard/
│   │   │   ├── bloc/
│   │   │   ├── screens/
│   │   │   │   └── dashboard_screen.dart
│   │   │   └── widgets/
│   │   ├── cases/
│   │   │   ├── bloc/
│   │   │   ├── screens/
│   │   │   │   ├── cases_list_screen.dart
│   │   │   │   └── case_detail_screen.dart
│   │   │   └── widgets/
│   │   ├── appointments/
│   │   │   ├── bloc/
│   │   │   ├── screens/
│   │   │   │   ├── appointments_list_screen.dart
│   │   │   │   └── appointment_detail_screen.dart
│   │   │   └── widgets/
│   │   ├── users/
│   │   ├── offices/
│   │   ├── tasks/
│   │   ├── notifications/
│   │   ├── records/
│   │   ├── reports/
│   │   ├── profile/
│   │   ├── documents/
│   │   ├── payments/                   # NEW: Client payments (Stripe)
│   │   │   ├── bloc/
│   │   │   │   ├── charges_bloc.dart
│   │   │   │   └── payment_flow_bloc.dart
│   │   │   ├── screens/
│   │   │   │   ├── my_charges_screen.dart
│   │   │   │   ├── pay_charge_screen.dart
│   │   │   │   └── payment_success_screen.dart
│   │   │   └── widgets/
│   │   │       ├── charge_card.dart
│   │   │       └── stripe_payment_sheet_widget.dart
│   │   └── admin/                      # Admin-only: CMS, contact submissions
│   │       ├── web_content/
│   │       └── contact_submissions/
│   └── l10n/                           # Localization (Spanish primary)
│       └── app_es.arb
│
├── test/
│   ├── unit/
│   │   ├── domain/
│   │   └── data/
│   ├── widget/
│   └── integration/
│
├── assets/
├── pubspec.yaml
└── README.md
```

---

## 5. Feature Parity Matrix (Admin-Portal → Mobile)

| Admin-Portal Feature | Mobile Screen / Flow | Notes |
|----------------------|----------------------|--------|
| Login | `LoginScreen` + `AuthBloc` | JWT stored in secure storage |
| Dashboard (role-based) | `DashboardScreen` + role widgets | Stats, today’s appointments, recent cases, announcements, notes |
| Cases list & filters | `CasesListScreen` | Pagination, search, status/category filters |
| Case detail | `CaseDetailScreen` | Stages, tasks, comments, documents, assign, complete |
| Appointments list & calendar | `AppointmentsListScreen` + calendar | Filters, create/edit/delete |
| Appointment detail | `AppointmentDetailScreen` | Edit, delete, link to case |
| Users list (admin/manager) | `UsersListScreen` | Create/edit user, search clients |
| User detail | `UserDetailScreen` | Profile, cases, appointments |
| Offices list & CRUD (admin) | `OfficesListScreen`, `OfficeDetailScreen` | |
| Tasks (case-level) | In case detail + `TaskModal`-like | Create/edit task, comments |
| Notifications | Drawer or list + WebSocket | Mark read, deep link |
| Records (archive) | `RecordsScreen` | Cases/appointments archived, restore, permanent delete |
| Reports | `ReportsScreen` | Summary, cases, appointments, export (share file) |
| Files / Documents | In case detail: upload, preview, download | |
| Profile & avatar | `ProfileScreen` | Edit profile, change avatar |
| Web content (CMS) | `WebContentScreen` (admin) | Site content, services, events, images |
| Contact submissions | `ContactSubmissionsScreen` (admin) | List only |
| **Payments (NEW)** | **My charges → Pay with Stripe → Success** | Client role: view charges, pay appointment/case fees |

---

## 6. New Feature: Client Payments (Stripe)

### 6.1 Goals

- Allow **clients** to see outstanding charges (e.g. appointment fees, case fees).
- Allow clients to **pay** for a specific appointment or for current case charges using **Stripe** (card, Apple Pay / Google Pay via Stripe).
- Keep payment logic and PCI scope on backend; mobile uses Stripe SDK only for collecting payment method and confirming PaymentIntent.

### 6.2 Backend Additions (API)

The following are **proposed** API additions (to be implemented in the Go API):

1. **Charges / Invoices (for client)**
   - `GET /api/v1/client/charges` — List outstanding charges for the authenticated client (appointment-related and/or case-related).  
     Response: list of `{ id, type: "appointment"|"case_fee", referenceId, description, amountCents, currency, status }`.

2. **Payment intents (Stripe)**
   - `POST /api/v1/client/charges/:chargeId/create-payment-intent` — Create a Stripe PaymentIntent for the given charge.  
     Response: `{ clientSecret }` for Stripe SDK.
   - `POST /api/v1/client/charges/:chargeId/confirm-payment` — Confirm payment (e.g. after Stripe confirms; optional if webhook-only).  
     Body: `{ paymentIntentId }`.  
     Response: updated charge status.

3. **Webhook (server-side)**
   - `POST /api/v1/webhooks/stripe` — Stripe webhook to confirm `payment_intent.succeeded` and update charge/invoice status and any internal accounting.

4. **Optional: Admin/Manager**
   - `GET /api/v1/admin|manager/charges` — List charges (e.g. by client, office) for reporting.
   - Create charge when creating appointment or setting case fee (or via separate `POST /api/v1/admin/charges`).

Database: add tables such as `charges` (id, user_id, type, reference_id [appointment_id or case_id], amount_cents, currency, status, stripe_payment_intent_id, paid_at, created_at, updated_at) and optionally `invoices` if you need more structure.

### 6.3 Mobile Flow (Client)

1. **Client** logs in → sees bottom nav or menu: **“Pagos”** / **“Mis cargos”**.
2. **My charges screen:** List of outstanding charges (from `GET /client/charges`). Each item: description, amount, “Pagar” button.
3. **Pay charge screen:**  
   - Call `POST /client/charges/:id/create-payment-intent` to get `clientSecret`.  
   - Use **Stripe SDK** (`flutter_stripe` or official Stripe Flutter) to present payment sheet (card / Apple Pay / Google Pay).  
   - On success, optionally call `POST /client/charges/:id/confirm-payment` or rely on webhook; then navigate to **Payment success**.
4. **Payment success screen:** Summary and “Back to charges” or “Back to home”.

### 6.4 SOLID / Patterns in Payment Feature

- **Repository:** `PaymentRepository` (interface in domain, implementation in data) — `getCharges()`, `createPaymentIntent(chargeId)`, `confirmPayment(chargeId, paymentIntentId)`.
- **Use cases:** `GetChargesForClientUseCase`, `CreatePaymentIntentUseCase`, `ConfirmPaymentUseCase`.
- **BLoC:** `ChargesBloc` (list charges), `PaymentFlowBloc` (create intent → present Stripe → confirm).
- **Dependency inversion:** `PaymentRepository` and Stripe SDK wrapper (e.g. `StripePaymentService`) behind an interface so tests can mock.

### 6.5 File Layout (Payments)

- `lib/domain/entities/charge.dart`, `payment_intent_result.dart`
- `lib/domain/repositories/payment_repository.dart`
- `lib/domain/use_cases/payments/get_charges_for_client_use_case.dart`, `create_payment_intent_use_case.dart`, `confirm_payment_use_case.dart`
- `lib/data/models/charge_dto.dart`, `payment_intent_dto.dart`
- `lib/data/repositories/payment_repository_impl.dart`
- `lib/presentation/payments/` (bloc, screens, widgets as in tree above)

---

## 7. Navigation & Role-Based Access

- **Router:** Use **GoRouter** (or AutoRoute) with:
  - **Redirect:** If not authenticated → login.
  - **Role-based routes:** Admin sees “Web content”, “Contact submissions”; Manager/Staff see Cases, Appointments, Users (if allowed), Records, Reports; **Client** sees Dashboard (limited), My cases, My appointments, **My charges / Pay**.
- **Nav items:** Driven by `role_config.dart` (mirror of admin-portal `getNavigationItemsForRole`). Different bottom nav or drawer items per role.
- **API base path:** Resolved by `EndpointResolver` (or equivalent) using current user role — same logic as admin-portal `getEndpointGroup(role)`.

---

## 8. Realtime & Notifications

- Reuse existing **WebSocket** `GET /ws?token=<jwt>` for in-app notifications.
- `WebSocketClient` in data layer; inject into a `NotificationRepository` or a dedicated `RealtimeBloc` that pushes notification events to a global stream; UI (e.g. bell icon) subscribes and shows count + list.

---

## 9. Implementation Phases (Suggested)

1. **Phase 1 — Foundation**  
   Project setup, `core/` (config, network, storage, auth interceptor), DI, auth flow (login, profile, token storage), app router with auth guard.

2. **Phase 2 — Core features**  
   Dashboard, Cases (list + detail), Appointments (list + detail), role-based endpoint resolution.

3. **Phase 3 — Users, Offices, Tasks, Documents**  
   Users CRUD (admin/manager), Offices, Tasks and comments, document upload/download in case detail.

4. **Phase 4 — Notifications, Records, Reports, Profile**  
   WebSocket notifications, Records (archive), Reports (and export), Profile and avatar.

5. **Phase 5 — Admin-only**  
   Web content (CMS), Contact submissions.

6. **Phase 6 — Payments (Stripe)**  
   Backend: charges table, endpoints, Stripe PaymentIntent + webhook. Mobile: `PaymentRepository`, use cases, Charges list screen, Pay flow with Stripe SDK, success screen.

---

## 10. Summary

- **Admin-portal** is fully analyzed; all features and role-based API usage are reflected in this design.
- The **Flutter app** is structured with **SOLID**, **OOP**, and **Repository/Use Case/BLoC** patterns, with a clear **core / domain / data / presentation** layout.
- **File architecture** is scalable and mirrors domain boundaries.
- **Client payment** is introduced as a new feature: clients can pay for appointments or current charges via **Stripe**, with backend-owned payment intents and webhooks and mobile using Stripe only for collection and confirmation.

This document is intended as the single source of truth for the Flutter mobile app design and the new Stripe-based payment feature. Backend API changes for payments should be implemented in the CAF Go API and documented in the same repo.
