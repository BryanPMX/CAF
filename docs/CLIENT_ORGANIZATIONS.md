# Maquilas and Constructoras

Both directories live in **Trabajo**, after Expedientes, Citas and Calendario.
They use existing client IDs throughout Usuarios, cases, appointments and events.
Both organization catalogs are shared across CAF offices. Individual clients,
cases and appointments retain their responsible offices. Calendar events retain
their organizer/participant access rules. Organization links never grant access
to another office’s service records.

## Access

Only Soporte Tecnico, Director Ejecutivo and Administrador can see either
sidebar entry, open its page or use the full directory API (including direct
record IDs). These roles can register/edit organization metadata and link
contacts. No organization deletion is exposed. An Administrador needs an
assigned office and sees only that office's individual contacts and factory
cases; global roles see all. Shared company identities are visible in all offices.

Other staff cannot browse either directory or edit its metadata/links. Existing
case forms retain a minimal factory-name/ID selector (`GET /maquila-options`),
and scoped current factory employment. Appointment/calendar selectors expose
minimal company identities alongside office-authorized individual clients. These
workflow endpoints do not expose company legal details or directory totals.
Clients cannot use either directory or these employee selectors. The API
independently enforces all permissions.

## Factory clients and case history

A person can have one current maquila relationship and must have a responsible
office before employment is linked. The same factory can serve clients of any
CAF office. A permitted client office transfer retains the shared factory link
and leaves the original office and employment snapshot on existing cases.

Select the factory in Usuarios or when opening a case, or link the existing
client from Maquilas. For a factory
relationship, **Número de Empleado** and **Turno** are required. Employee numbers
are text, preserving leading zeroes. Turno is a name (suggestions are editable),
with optional paired start/end times in local `HH:mm` format. Overnight shifts
are valid. Hours are descriptive employment information, not appointment slots.

A new case copies the selected client's current employment unless the request
explicitly supplies `employment`. Neither client nor case office is inferred
from the factory. The case stores an independent snapshot of
factory ID, employee number, shift name and hours. Moving/unlinking a client
never rewrites existing cases. The former factory still lists its visible
historical cases and marks clients without a current membership **Histórico**.
Updating other case fields leaves employment untouched; explicit employment
edits affect only that case. Inline creation of a new client and case saves the
client's current employment and the case snapshot in one transaction.

An individual can be a contact for multiple construction companies while
retaining their current factory relationship. Authorized office transfers keep
these relationships and existing case history. Changing a linked individual's
role or removing their responsible office requires unlinking first. A contact
link never associates all of that person's cases with the construction company;
there is no company-case collection or fabricated company case.

## Construction companies

All five registry fields are required: Nombre, Apoderado legal, Domicilio legal,
Presidente del Consejo and Nombre de la colonia. Email and phone are optional.
Each company owns one canonical `users` record with role `client` and
`clientType: "organization"`, using the company name rather than invented
personal names. Existing users default to `clientType: "person"`.

The company account appears in Usuarios and cannot be deleted separately from
the registry, converted into a person, assigned another role or given an owning
office. Edits to its name/email/phone stay synchronized between
Usuarios and Constructoras. Legal information stays in Constructoras. Its
Usuarios office cell says **Todas las oficinas**; individual contacts keep their
own office. Its
initial password is random; no credentials are displayed or emailed. Blank
emails cannot sign in. All supplied emails remain unique, including deleted
accounts; the database permits multiple company records without email.

Link existing individual clients as contacts without merging identities or
creating cases. Each construction company keeps its own account as a permanent
relationship. The directory supports registration, editing and contact links;
organization deletion is intentionally not exposed.

**Agendar cita** in the registry and **Cita para constructora** in Citas share
the same form and availability picker. They save `clientId` with a NULL
`case_id`, without creating a case. The form selects a responsible office
independently of the shared company;
Administradores use their assigned office and global roles can select any.
The API validates the company, assigned staff, office, working hours and
conflicts. Company appointment edits preserve
the office boundary and check conflicts again when staff/time changes. Company
names are included in normal appointments, calendar, dashboard, archives and
appointment reports. Individual case workflows continue to use real cases;
company accounts are excluded from their selectors and rejected as case clients.

Internal calendar events can link multiple clients through **Clientes
relacionados**. These links do not invite clients or grant calendar access.
Employee attendees retain their existing invitation and access rules. A local
administrator sees/selects only client links in their office; editing a shared
event preserves hidden client links from other offices. Up to 50 related clients
are supported per event.

## API contract

All routes require a current employee JWT and backend office authorization:

| Route | Behavior |
| --- | --- |
| `GET /api/v1/organizations?kind=maquila|constructora` | Management-only shared registry list; `q`, `id`, `page`, `pageSize` (default 20, max 100) |
| `POST /api/v1/organizations` | Administrator/global-role registration; `kind`, `name`; neither kind accepts office ownership; companies require legal fields |
| `GET /api/v1/organizations/:id` | Organization, `accountClient`, paginated `clients`/`cases`, `clientTotal`/`caseTotal`; `clientPage`, `casePage`, `clientQ` |
| `PATCH /api/v1/organizations/:id` | Management-only full registry form update |
| `POST /api/v1/organizations/:id/clients` | Link `clientId`; maquilas also require employment fields |
| `DELETE /api/v1/organizations/:id/clients/:clientId` | Remove current relationship; preserves historical cases |
| `GET /api/v1/client-organizations/:clientId` | Scoped current memberships in `data` |
| `GET /api/v1/maquila-options` | Minimal factory `id`/`name` selector for employees; `q`, `id`, max 100 |
| `GET /api/v1/client-options` | Minimal scoped selector data; `q`, `officeId`, `clientType`, max 50 |

User create/update and case create/update accept nested
`employment: {maquilaId, employeeNumber, shiftName, shiftStart, shiftEnd}`.
For users, omitted employment preserves current links; `{maquilaId:null}`
clears the current factory. For case creation, omitted employment copies the
current relationship; explicit null factory creates a case without a factory.
For case update, omitted employment preserves history. To clear employment,
omit or clear all associated fields as well as setting the factory to null.

The existing smart appointment POST routes accept `withoutCase:true`, `clientId`,
`officeId` and normal staff/schedule/title/status fields for company appointments.
Calendar create/update accepts `relatedClientIds`; responses include
`relatedClients: [{clientId, client}]`. Appointment responses include direct
`clientId`/`client` or the existing `case.client` relationship.

## Deployment

Deploy API and portal together. Migration `0063_client_organizations.sql` runs
at API startup. It adds organization, membership, employment snapshot and event
relationship tables/columns, changes the users email uniqueness rule to a
partial unique index for nonblank emails, and makes `appointments.case_id`
nullable with a case-or-client check constraint. Existing users remain individual
clients and existing cases/appointments keep their relationships. The migration
is rerunnable and covered against PostgreSQL 15 with the production Docker image.

Take the normal database backup before rollout. Redeploy the new API image
before using the new portal forms. Because direct company appointments have a
NULL case ID, reverting to an older API requires an explicit compatible data
migration; do not restore the old NOT NULL constraint while such appointments
exist.

See [testing instructions](../testing/README.md) for Go, browser, production
build and isolated Docker/PostgreSQL checks.


## Shared-factory and role upgrade

Deploy API and portal together. Migration `0065_single_office_administrator.sql`
converts every legacy `office_manager` account to `admin` in its existing office,
including disabled/deleted accounts. It preserves identity, credentials and
status, increments the credential version once and rejects future use of the
retired role. Migrated users must sign in again. Missing office assignments are
not guessed; CEO/support must assign one before the account can use office data.
The `/manager` route group, role selectors, route mappings and permissions are
removed. Administrador, Director Ejecutivo and Soporte Tecnico remain distinct.

Migration `0066_shared_maquila_directory.sql` removes factory office ownership
and preserves the former office ID in database-only `legacy_office_id` for audit.
It does not merge or delete organizations, memberships or cases, or rewrite case
references or employment snapshots. Existing factories with identical names
remain separate records, identified by their record IDs in the catalog and
selectors. New duplicate names are rejected by serialized API mutations.
The following company upgrade supersedes the former office-owned Constructoras model.

Factory create/update requests omit `officeId`; nonzero factory office ownership
is rejected. Case/user employment still requires the record's responsible office
to be authorized. Existing role/office guards continue to protect users, cases,
appointments, calendar clients, archives and reports.


## Shared company upgrade and restricted directories

Migration `0067_shared_constructoras.sql` removes company office ownership and
clears only their canonical client accounts’ owning office. It preserves former
registry/account offices in database-only audit columns. It preserves all IDs,
credentials, account status, contacts, appointments, calendar links, individual
client offices and case history; it never merges duplicate companies. Existing
duplicate names remain identifiable by record ID, and serialized API writes
reject new duplicate names within each kind, including renames from Usuarios.
The migration is repeatable and verified on PostgreSQL 15.

Deploy API and portal together. Company appointments keep their original office;
new ones explicitly choose the office responsible for that appointment. Sharing
the company identity never broadens appointment, event, archive or report access.
