# Portal roles and office boundaries

The API reads the current role and office from the database on every request.
JWTs identify users; cookies and hidden navigation items are not authorization.

| Capability | Soporte Tecnico (`technical_support`) | Director Ejecutivo (`executive_director`) | Administrador (`admin`) |
| --- | --- | --- | --- |
| Panel de Control | Organization totals; optional office filter | Organization totals; optional office filter | Assigned-office totals |
| Cases, appointments, tasks and case documents | All offices | All offices | Assigned office, including direct IDs and mutations |
| Internal calendar | All meetings | All meetings | Meetings whose organizer belongs to the assigned office |
| Calendar invitations and employee selection | All employees | All employees | Assigned-office employees |
| User details and role assignments | All users; can assign executive role | All offices except protected support account; can assign executive role | Assigned office; cannot modify executives or support |
| Change an existing user's password | Allowed, including own account and CEO | Denied | Denied |
| Office details | All offices; create, edit and delete | All offices; create, edit and delete | View and edit assigned office; cannot create or delete offices |
| Archives and reports, including CSV exports | All offices | All offices | Assigned office |
| Sitio Web, organization announcements and system operations | Allowed | Allowed | Denied |

The sidebar entry is **Oficinas** for both global and office-scoped roles. The
label does not expand Administrador permissions. Global roles have blank office
cells and no office fields in their profile/edit forms.

An administrator without a nonzero office assignment receives HTTP 403. Search
filters only narrow access. Case updates accept an explicit field allowlist;
office reassignment is not part of that endpoint. New user creation and email
reactivation follow the same scope and role checks. Office managers also use
the shared user-management implementation and cannot assign administrative or
executive roles. Staff and client assignment/ownership rules remain in force.

User-management actions also check the target account. An executive account is
read-only to Administradores and office managers, even if it retains a legacy
office assignment. Edit links refresh the target from the API before opening the
form; direct edit URLs follow the same rule. Executive rows show an empty Oficina
cell, and executive profiles/edit forms omit office-specific fields because the
role has organization-wide access.

Employees retain participant-based calendar visibility. Management visibility
follows the organizer's current office, because calendar events do not store a
separate office. Existing cross-office meetings remain visible to their employee
participants. Administrators cannot use such invitations to expand their scope.

Notifications about contact inquiries, client comments and payments go to all
executives, technical support and the relevant office's administrators/managers. Routine appointment
WebSocket broadcasts contain an invalidation signal only; the portal fetches
record details through authorized endpoints.

## Deployment and first executive

Deploy the API and portal together. This change deliberately does not promote
every existing administrator. `users.role` is already a free-form VARCHAR, so no
role-column type change is required. Migration `0062` adds the credential
version used to invalidate sessions after a password reset.

Before enabling the new policy, the database operator must identify the CEO's
existing active account and promote that specific account. For example, with
`psql` and a verified numeric `ceo_user_id` variable:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
UPDATE users
SET role = 'executive_director', updated_at = NOW()
WHERE id = :ceo_user_id
  AND role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
RETURNING id, email, role;
-- Verify exactly the intended account was returned before committing.
COMMIT;
```

Assign every remaining administrator to its intended office. Audit missing
assignments with:

```sql
SELECT id, email, office_id
FROM users
WHERE role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
  AND (office_id IS NULL OR office_id = 0);
```

Have affected users sign out and sign in to refresh portal role/office state.
Existing tokens immediately follow the current database permissions. Additional
executives can then be provisioned by Director Ejecutivo through Usuarios.
The API prevents demotion or deletion of the last active executive; PostgreSQL
advisory locks serialize user mutations across API instances. A busy lock returns
HTTP 503 with `Retry-After` instead of waiting indefinitely. Each operation uses
an isolated GORM session, and lock cleanup runs even after request cancellation.
Connections are discarded if the lock cannot be released.

## Protected startup support account

Migration `0062_protected_technical_support.sql` upgrades only historical system
user **ID 1**, and only when its current role is `admin` or `executive_director`,
to **Soporte Tecnico** (`technical_support`). It clears the obsolete office
assignment and preserves the email, names, password hash, active/deleted state,
and other account details. It does not promote other administrators or the CEO's
separate account. It never reactivates the insecure default disabled by `0059`.
Deploy API and portal together, then sign out and sign in to refresh the label.
No manual SQL or credential reset is needed for an active customized system account.

For a fresh installation, the existing one-time `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD` variables provision **Soporte Tecnico**. The variables
retain their names for deployment compatibility. Remove them after successful
bootstrap. An existing support account (including a disabled/deleted one) prevents
another bootstrap; an existing email is never overwritten. A partial unique index
allows only one support account. Fresh-install migration audit entries are skipped
until user ID 1 exists; the migration ledger still records every applied migration.

Support cannot be created, assigned, demoted, soft-deleted or permanently deleted
through ordinary user endpoints, including by support itself. CEO/admin/manager
accounts cannot modify support. Support may update its own contact details and
password; its role remains fixed. The historical ID 1 deletion protection remains
in place. The last active CEO must still be preserved, even by support.

In **Usuarios → Editar**, support has an optional **Nueva contraseña** field.
Leaving it blank preserves the password. New passwords use the same policy as
account creation: 12+ characters, uppercase, lowercase, number, symbol, maximum
72 UTF-8 bytes, and no known insecure defaults. The API checks this independently
of the UI, hashes the password with bcrypt, and never returns the hash or plaintext.
An ordinary detail edit and optional password change are saved together only after
all validation passes. Resetting increments `token_version`: prior JWTs fail both
role and data middleware, and new WebSocket handshakes, while a new login receives
the current version. Existing notification sockets on the handling API instance
are closed. Existing JWTs without a version remain compatible at version zero.
Changing one's own password signs support out and requires a new login.

## Verification

Run `go test ./...` from `api` and `npm run test:roles` from `testing`. The Go
suite uses isolated SQLite databases with synthetic offices, users, cases,
appointments and meetings to exercise real JWT middleware and handlers. It does
not validate PostgreSQL migrations or PostgreSQL advisory-lock behavior.
The isolated Docker check in the testing guide runs the production image against
PostgreSQL 15 to cover migration, bootstrap, reset, protections and restart persistence.

See [the testing guide](../testing/README.md#role-isolation-regression-checks)
for the live browser checks. Production PostgreSQL/Docker validation should use
the same two-office matrix before rollout.

## Profiles

`GET /api/v1/profile` (employees) and `GET /api/v1/client/profile` share an
explicit response contract backed by the authenticated database account. Besides
the existing identity/avatar fields, it includes email, phone, department,
specialty, active status, creation date, last sign-in and the avatar upload policy.
Global roles return no office assignment, including legacy assignments. These
responses are private and not cacheable. Reading a profile never updates
`last_login`; successful sign-in remains its source of truth. Password hashes,
credential versions, payment identifiers and personal addresses are excluded.

The portal reuses `ProfileCard`, its profile types/helpers, and `PROFILE_TEXT`
for Mi perfil and the user detail view. Contact/office fields and compact account
dates are shown; optional department/specialty fields appear only when populated.
Personal addresses, activity feeds, case counters and permission matrices are
intentionally omitted to keep the view focused. Existing user-detail API scope
and edit permissions still apply. Photo controls are expandable and available
only for one's own account. The API supplies MIME types, size and URL limits;
removal explicitly sends an empty avatar URL and clears the shared avatar state.
