# CAF Mobile — Desktop Workflows and Native Design

Version: 4.0 · November 22, 2026

## Product and authorization

One Flutter application serves Android and iOS, with a phone/tablet layout based
on the desktop portal's CAF colors, Spanish labels and form grouping. Workflow
implementation is separate from store-release readiness. The release requirements
below still apply; this document does not certify every workflow on physical devices.

All eight current roles can sign in. The database-backed API remains authoritative
for office scope, assignments, protected accounts and organization access. Unknown
and retired roles are rejected. See [access policy](ACCESS_CONTROL.md) and
[organization contracts](CLIENT_ORGANIZATIONS.md).

Authentication verifies the authoritative profile before showing a workspace.
Session restoration falls back from `/client/profile` to `/profile` only on 403.
Expired credentials never fall through to another role. Each session owns its
navigation stack. Session-bound HTTP adapters reject operations when the account
changes, including changes while secure credentials are being read. Signing out
clears app-private document/report previews and invalidates pending UI operations.

## Implemented workflows

| Area | Mobile implementation |
| --- | --- |
| Dashboard | Role-specific summary, global-office filter, upcoming appointments/meetings, quick actions and links to notes/announcements |
| Cases | Scoped search, status filtering, server pagination, detail, create/edit, existing/new clients, office selection and independent Maquila snapshots |
| Case management | Assignment, category-specific stages, completion/archive and deletion; management and primary-professional controls follow desktop policy |
| Tasks | Case/standalone creation, assignment, due date, editing/status/deletion, discussion and author comment edits/deletion; additional assignees have completion controls |
| Case documents | Native file selection, explicit internal/client visibility, upload, authenticated opening, author metadata edits and permitted deletion |
| Case discussion | Internal/client-visible comments, author editing and permitted deletion |
| Appointments | Search/filter/list/detail, existing/new clients and cases, direct company appointments, scoped employee selection, future interval validation, privacy-safe availability slot picker/conflict checks, edit/reschedule/status/cancel and deletion |
| Calendar | Combined month/day agenda, native month calendar, meetings and appointments, participant responses, related individuals/companies, date filtering and permitted editing/deletion |
| Users | Scoped search/role/activity/office filters, profile/contact-inquiry details, create/edit, protected roles, optional support-only password reset, Maquila employment, soft/permanent deletion |
| Offices | Directory, staff/client detail, assigned-office edit and global create/delete; latitude/longitude validation |
| Maquilas/Constructoras | Shared catalogs, search/pagination, create/edit, scoped related clients/cases, related-record pagination/search and link/unlink operations |
| Archives | Cases/appointments, search, case archive-type filter, restore and explicitly confirmed permanent deletion |
| Reports | Scoped summaries/distributions, case/appointment reports, date/department/office filters and CSV export; global management can view cumulative organization metrics |
| Content | Permitted website content, services, events, gallery/image upload and announcements; personal notes and permitted announcement dismissal |
| Profile | Shared identity/contact/organization/account sections, server-provided display metadata, expandable photo upload/URL/removal for employees and clients |
| Notifications | Scoped inbox, mark-read, known internal action links, foreground invalidation and resume refresh |
| Client portal | Existing safe case details/messages, appointments, notifications, payments/receipts and contact; case/appointment history now reads all server pages |

The desktop's placeholder Files page is not presented as a working standalone
module. Document operations live inside authorized case details. Organization
catalogs have no deletion endpoint; the app exposes their supported create/edit
and relationship operations instead.

Native background push is a separate delivery channel. Foreground WebSockets and
resume refresh implement the current desktop notification behavior. Payment
processing remains server-created Stripe Checkout plus webhook reconciliation.
Receipt history remains bounded by the existing server endpoint; the app does not
invent a Stripe cursor or treat a return link as proof of payment.

## Consistent mobile design

Use CAF teal actions, blue accents, navy navigation and a light slate background.
Phone navigation uses a bottom bar with a role-filtered workspace menu. Wider
layouts use a scrollable navy side panel. Editors are full-screen, grouped in
shared white sections, with a persistent save action above the keyboard.

Case creation follows the desktop's Cliente, Datos de maquila, Datos del caso and
Datos adicionales groups. Shared record editors supply searchable selectors,
multiselect sheets, native date/time controls, required markers, validation,
retained input on failure, retry states and discard confirmation. Fields stack
on narrow screens or with large text; two columns are used when space permits.
Destructive operations require a concrete confirmation.

Employment values preserve leading zeroes and case-specific history. Changing
clients clears previous employment and ignores late membership responses. Saving
is blocked while a membership load fails. Optional shift times must be paired
HH:mm values; overnight shifts are accepted. Editing case employment does not
rewrite the client's current membership.

Scheduling displays device-local dates/times. Requests include RFC3339 offsets
so the API evaluates working hours against the chosen local wall time rather
than UTC. Server conflict and permission checks remain authoritative. Meeting
participants are employees; related clients never receive calendar access.

## Architecture and dependencies

```text
client-app/lib/src/portal/
  access.dart                 Roles and case-management presentation policy
  models.dart                 Typed case/employment values, parsing/date helpers
  repository.dart             Case repository interface and HTTP adapter
  controllers.dart            Case pagination, employment and save state
  workspace_repository.dart   Directory/scheduling/task/report/profile contracts
  record_editor.dart          Shared accessible record editor and selectors
  catalog_forms.dart          Explicit domain field allowlists and payload rules
  availability_picker.dart    Busy/free local scheduling slots
  ui.dart                     Shared sections, fields, errors and empty states
  employee_shell.dart         Session workspace and responsive navigation
  dashboard_screen.dart       Summary, office scope and combined upcoming agenda
  agenda.dart                 Shared time boundaries, office scope and ordering
  calendar_screen.dart        Combined month/day calendar and agenda
  metrics_screen.dart         Actual cumulative metrics for global management
  workspace_menu.dart         Role-filtered destinations
  workspace_list.dart         Lists, filters, pagination and creation entry points
  workspace_detail.dart       Authorized record detail and actions
  case_editor.dart            Case create/edit form
  case_detail.dart            Case detail and timeline
  case_tools.dart             Case/task/document actions
  profile_screen.dart         Shared employee/client self-profile and photo controls
  reports_screen.dart         Reporting filters, views and CSV opening
  session_refresh.dart        Debounced invalidation bindings and disposal
  notification_navigation.dart Known internal notification destinations
  private_files.dart          App-private temporary downloads and logout cleanup
```

Widgets use repository contracts. HTTP paths/verbs belong to adapters, domain
payloads belong to form definitions/controllers, and shared editors own layout and
save state. Revision checks prevent late responses replacing current records.
Open case/detail/list/calendar routes refresh independently from invalidations and resume;
unsaved editors retain their own captured input.

Material widgets, Provider, `http`, secure storage, `open_filex` and SDK Spanish
localization are reused. The additional native dependency is Flutter's maintained
[file_selector](https://pub.dev/packages/file_selector), using system file pickers
rather than broad media/storage permissions. Server-side MIME/content/size checks
remain required. No third-party UI framework or parallel state-management stack
is added. Integration tests use Flutter's SDK package.

## API contract notes

- Cases: `/admin/cases` for management, `/staff/cases` for other employees.
  Listing uses `page`, `limit`, `search`, `status`; totals use `pagination.total`.
  Updates are `PUT`. Responsible-office reassignment is not part of case editing.
- Tasks: protected `/tasks` routes; create requires `caseId`, updates use `PUT`.
  Detail wraps the record in `task`; task discussion uses `comment`.
- Appointment creation uses role-prefixed smart-creation endpoints. Management
  updates use `PATCH`, staff updates use `PUT`. Management detail wraps the
  record in `appointment`. Client case selectors return `cases`, not `data`.
- `/appointment-availability` discloses busy intervals only. Employee options come
  from `/calendar/staff`; appointment choices additionally narrow to actor scope.
- Calendar listing uses `/calendar/events` and `dateFrom`/`dateTo`; responses use
  `PATCH /calendar/events/:id/response`. There is no individual meeting GET route.
  The existing API caps each meeting range at 500 records and appointment ranges
  at 100. These endpoints return the bounded result together rather than applying
  server pagination. Day view narrows dense calendars; changing these server
  limits is outside this mobile change. Agenda date filters use each endpoint's
  contract and then intersect exact local instants before chronological ordering.
- Minimal workflow selectors remain `/client-options`, `/maquila-options`, and
  `/client-organizations/:clientId`; full directories use `/organizations`.
- Archives return `cases` or `appointments` plus `pagination`.
- Organization-wide `/admin/dashboard/stats` is restricted to global roles.
  Placeholder backup/health/business figures and unimplemented invoice balances
  are not presented as real measurements.
- CMS lists use `content`, `services`, `events`, `images`; content upserts use POST.
- Profile photo policy comes from the server; uploads use `avatar`. Case/gallery
  multipart uploads use `file`. Authenticated document opening uses `/documents/:id`.
- Notifications use `notificationIds` for mark-read. WebSockets authenticate with
  `caf.jwt.<jwt>` subprotocol, never a token in a URL.

## Validation and local native tests

Toolchain: Flutter 3.35+ / Dart 3.9+; iOS deployment minimum 15.0.

```bash
cd client-app
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

Native tests use an isolated loopback fixture with synthetic accounts, in-memory
SQLite and temporary local file storage. They do not load production credentials
or call Stripe; receipts explicitly return 503. Native tests reject a nonlocal
API configuration before starting. Restart the fixture between full native runs
so scheduling tests begin with fresh synthetic availability.

```bash
# Terminal 1, repository root:
cd api
CAF_RBAC_PREVIEW=1 go test ./handlers -run '^TestOfficeAuthorizationPreview$' -count=1 -timeout=0 -v

# Terminal 2:
cd client-app
flutter drive --driver=test_driver/mobile.dart \
  --target=integration_test/portal_smoke_test.dart -d <device-id> \
  --dart-define=CAF_API_BASE_URL=http://127.0.0.1:8080/api/v1 \
  --dart-define=CAF_WS_BASE_URL=ws://127.0.0.1:8080/ws
# Android emulator: replace loopback host in both URLs with 10.0.2.2.
```

The driver saves iPhone screenshots to `/tmp/caf-mobile-e2e` (override with
`CAF_MOBILE_ARTIFACT_DIR`). Android runs the same functional scenarios without
SDK screenshot capture. Stop the fixture and shut down devices started for testing.
The fixture handles termination so temporary storage is removed. Do not publish
this synthetic fixture through a tunnel.

Tests cover role/session boundaries, server contracts, pagination, employment
snapshots, stale requests, failed saves, large text, narrow layouts, keyboards,
background invalidation disposal and session-bound credentials. Native scenarios
cover Maquila case creation/editing, staff/client account separation, user/task
management and meeting/appointment edits with time preservation. These scenarios
are not exhaustive physical-device, payment-provider, file-picker or CMS QA.
SQLite checks do not validate PostgreSQL-specific content arrays or migrations.

The installed Flutter/Xcode combination cannot package its generic fat simulator
artifact reliably. Build/run against a concrete arm64 simulator. A successful
simulator build does not establish App Store signing or physical-device readiness.

### Verified locally on November 22, 2026

- Flutter 3.35.4 / Dart 3.9.2: analyzer clean; all 51 unit/widget tests passed.
- API: `go test ./...` passed.
- Native integration: all four workflow scenarios passed on both iPhone 17 Pro
  (iOS 26.0 simulator) and Android API 36.1 emulator, using the isolated API.
- Main application: Android debug APK and concrete arm64 iOS simulator build
  passed. The final builds target `lib/main.dart` with default production URLs,
  without integration-test entry points or loopback overrides.
- Android release without signing configuration failed with the intended guard.
  No store-signed artifact was produced.
- Synthetic API/storage and the test devices were stopped after verification.

## Release requirements

The source is ready for review and a controlled pilot build. Store deployment
still requires CAF's identifiers, signing assets, account setup and device QA.

Android release builds no longer fall back to debug signing. The build must supply:

- `CAF_ANDROID_APPLICATION_ID` (a CAF-owned ID, not `com.example.*`)
- `CAF_KEYSTORE_PATH`, `CAF_KEYSTORE_PASSWORD`, `CAF_KEY_ALIAS`, `CAF_KEY_PASSWORD`

Without these, release tasks fail explicitly. Debug builds retain the existing
template ID for local development. Keep keystores/passwords outside Git and use
the build environment or CI secret manager.

iOS needs a registered CAF bundle identifier, development team, signing and
provisioning configured in Xcode/CI. Complete physical Android/iPhone testing,
production HTTPS and secure-storage checks, native file/photo opening, real
Stripe return/webhook reconciliation, accessibility review, store metadata and
privacy disclosures before distribution. FCM/APNs and platform/domain association
for HTTPS app links require their own configured services; neither is implied by
foreground WebSockets or Dart URL recognition.

References: [Flutter adaptive design](https://docs.flutter.dev/ui/adaptive-responsive),
[architecture recommendations](https://docs.flutter.dev/app-architecture/recommendations),
[Android deployment](https://docs.flutter.dev/deployment/android) and
[iOS deployment](https://docs.flutter.dev/deployment/ios).
