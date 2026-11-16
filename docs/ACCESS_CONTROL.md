# Portal roles and office boundaries

The API reads the current role and office from the database on every request.
JWTs identify users; cookies and hidden navigation items are not authorization.

| Capability | Director Ejecutivo (`executive_director`) | Administrador (`admin`) |
| --- | --- | --- |
| Panel de Control | Organization totals; optional office filter | Assigned-office totals |
| Cases, appointments, tasks and case documents | All offices | Assigned office, including direct IDs and mutations |
| Internal calendar | All meetings | Meetings whose organizer belongs to the assigned office |
| Calendar invitations and employee selection | All employees | Assigned-office employees |
| Users | All offices; can assign executive role | Assigned office; cannot create, promote, modify or delete executives |
| Office details | All offices; create, edit and delete | View and edit assigned office; cannot create or delete offices |
| Archives and reports, including CSV exports | All offices | Assigned office |
| Sitio Web, organization announcements and system operations | Allowed | Denied |

An administrator without a nonzero office assignment receives HTTP 403. Search
filters only narrow access. Case updates accept an explicit field allowlist;
office reassignment is not part of that endpoint. New user creation and email
reactivation follow the same scope and role checks. Office managers also use
the shared user-management implementation and cannot assign administrative or
executive roles. Staff and client assignment/ownership rules remain in force.

Employees retain participant-based calendar visibility. Management visibility
follows the organizer's current office, because calendar events do not store a
separate office. Existing cross-office meetings remain visible to their employee
participants. Administrators cannot use such invitations to expand their scope.

Notifications about contact inquiries, client comments and payments go to all
executives and the relevant office's administrators/managers. Routine appointment
WebSocket broadcasts contain an invalidation signal only; the portal fetches
record details through authorized endpoints.

## Deployment and first executive

Deploy the API and portal together. This change deliberately does not promote
every existing administrator. `users.role` is already a free-form VARCHAR, so no
schema migration is required.

Before enabling the new policy, the database operator must identify the CEO's
existing active account and promote that specific account. For example, with
`psql` and a verified numeric `ceo_user_id` variable:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(1976081601);
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
advisory locks serialize user mutations across API instances.

For a fresh installation, the existing one-time `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD` variables now provision the first **Director Ejecutivo**.
The variables retain their names for deployment compatibility. Remove them after
successful bootstrap. Existing email accounts are never silently overwritten.

## Verification

Run `go test ./...` from `api` and `npm run test:roles` from `testing`. The Go
suite uses isolated SQLite databases with synthetic offices, users, cases,
appointments and meetings to exercise real JWT middleware and handlers. It does
not validate PostgreSQL migrations or PostgreSQL advisory-lock behavior.

See [the testing guide](../testing/README.md#role-isolation-regression-checks)
for the live browser checks. Production PostgreSQL/Docker validation should use
the same two-office matrix before rollout.
