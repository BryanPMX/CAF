# Maquilas and Constructoras

Both directories live in **Trabajo**, after Expedientes, Citas and Calendario.
They use existing client IDs throughout Usuarios, cases, appointments and events.
Maquilas form one shared factory catalog across all CAF offices. Constructoras
retain a responsible office. Clients and cases always retain their own office
assignments; a factory relationship never grants access to another office.

## Access

Soporte Tecnico and Director Ejecutivo see and manage all records. Administrador
is the only office-management role; it manages clients, cases and construction
companies within its assigned office. Employees can read the shared factory
catalog, while a factory's client/case lists, counts and mutations follow their
existing office and case access rules. Clients cannot access these directories.

Administradores, CEO and support can register/edit shared factory names. Other
staff cannot modify catalog metadata or client links. No organization deletion
is exposed. Factory metadata is shared; client information is not. The global
roles see all related offices, while each Administrador sees only authorized
clients/cases. Filters, pagination, direct IDs and employment mutations enforce
this in the API, independently of navigation.

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
retaining their current factory relationship. A client's role/office cannot
change while incompatible organization links remain. Unlink those records
first; historical case snapshots remain intact and follow case access rules.

## Construction companies

All five registry fields are required: Nombre, Apoderado legal, Domicilio legal,
Presidente del Consejo and Nombre de la colonia. Email and phone are optional.
Each company owns one canonical `users` record with role `client` and
`clientType: "organization"`, using the company name rather than invented
personal names. Existing users default to `clientType: "person"`.

The company account appears in Usuarios and cannot be deleted separately from
the registry, converted into a person, assigned another role or moved to a
different office. Edits to its name/email/phone stay synchronized between
Usuarios and Constructoras. Legal information stays in Constructoras. Its
initial password is random; no credentials are displayed or emailed. Blank
emails cannot sign in. All supplied emails remain unique, including deleted
accounts; the database permits multiple company records without email.

Link existing individual clients as contacts without merging identities or
creating cases. Each construction company keeps its own account as a permanent
relationship. The directory supports registration, editing and contact links;
organization deletion is intentionally not exposed.

**Agendar cita** in the registry and **Cita para constructora** in Citas share
the same form and availability picker. They save `clientId` with a NULL
`case_id`, without creating a case. The API validates the company, assigned
staff, office, working hours and conflicts. Company appointment edits preserve
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
| `GET /api/v1/organizations?kind=maquila|constructora` | Scoped registry list; `q`, constructor-only `officeId`, scoped `id`, `page`, `pageSize` (default 20, max 100) |
| `POST /api/v1/organizations` | Administrator/global-role registration; `kind`, `name`; only companies use `officeId` and legal fields |
| `GET /api/v1/organizations/:id` | Organization, `accountClient`, paginated `clients`/`cases`, `clientTotal`/`caseTotal`; `clientPage`, `casePage`, `clientQ` |
| `PATCH /api/v1/organizations/:id` | Management-only full registry form update |
| `POST /api/v1/organizations/:id/clients` | Link `clientId`; maquilas also require employment fields |
| `DELETE /api/v1/organizations/:id/clients/:clientId` | Remove current relationship; preserves historical cases |
| `GET /api/v1/client-organizations/:clientId` | Scoped current memberships in `data` |
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
Constructoras retain their existing office ownership and uniqueness rules.

Factory create/update requests omit `officeId`; nonzero factory office ownership
is rejected. Case/user employment still requires the record's responsible office
to be authorized. Existing role/office guards continue to protect users, cases,
appointments, calendar clients, archives and reports.
