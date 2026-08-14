# CAF Security Audit — 2026-08-14

## Executive summary

The public GitHub repository does not automatically publish the live PostgreSQL database, uploaded files, Portainer environment variables, or Docker named volumes. Those assets live on the Docker host or configured storage provider. Git publishes tracked source files and every reachable historical revision, however, so a secret committed and later deleted must still be treated as exposed.

This review found critical authorization and credential-management weaknesses in the application source and historical credential material in Git. The code-level issues listed as remediated below were corrected in this hardening change. The historical material cannot be made safe by deleting the current files: credentials must be rotated, then history must be rewritten if the project owner wants the old content removed from reachable Git refs.

The production endpoint checked on 2026-08-14 did not yet expose the new security headers or rate-limit configuration. The hardened code therefore still needs to be built, pushed, and redeployed before it protects the running service.

## Data boundary

| Asset | Automatically public through GitHub? | Where it normally resides |
|---|---:|---|
| Tracked source and configuration templates | Yes | Git commits and forks |
| Deleted but historically committed files | Yes, while reachable in history | Git objects, clones, forks, caches |
| Portainer environment variables and secrets | No | Portainer/Docker host |
| PostgreSQL records | No | `caf_postgres_data` named volume |
| Locally uploaded documents | No | `caf_uploads` named volume |
| S3 objects | No, unless bucket/object policy or ACL permits it | Configured object store |
| Container filesystem changes | No | Container writable layer; ephemeral unless persisted |
| Published container image | The image is public if its registry repository is public | Container registry; it does not include named-volume data |

## Remediated findings

| Severity | Finding | Remediation in this change |
|---|---|---|
| Critical | Public registration accepted privileged roles | Removed public registration; clients are provisioned by authenticated staff workflows only |
| Critical | Appointment maintenance mutation was registered without authentication | Moved it into the authenticated administrator route group |
| High | Default administrator credentials were seeded and documented | Removed the seed, disabled the unchanged legacy account through a migration, and added one-time explicit bootstrap credentials with a strong password policy |
| High | Disabled accounts could authenticate or retain some access | Login, refresh, HTTP authorization, and WebSocket connection paths now verify active accounts |
| High | Case comments/documents could be accessed by identifier without consistent case authorization | Added case-level object access checks to document and event handlers |
| High | JWT validation accepted a broad HMAC family and lacked strict claims | Restricted tokens to HS256 with issuer, audience, expiration, and bounded lifetime checks |
| High | JWTs were sent in WebSocket query strings | Moved them to a WebSocket subprotocol and added origin validation |
| High | Generated users received predictable shared passwords | Replaced shared defaults with cryptographically random, nonrecoverable credentials; a proper invitation/reset flow remains required |
| High | S3 uploads requested public-read ACLs | Removed public ACL assignment and preserved validated content types |
| High | Vulnerable Go and JavaScript dependencies | Updated the Go dependency graph and Go builder to 1.26.6; upgraded the admin portal to Next.js 16.3.1; applied npm security updates |
| Medium | Upload controls trusted filenames/content types too broadly | Added byte sniffing, extension allowlists, size limits, safer response disposition, private caching, and blocked HTML/SVG document preview |
| Medium | Local upload permissions and traversal checks were weak | Restricted directories/files to `0700`/`0600` and enforced containment under the upload root |
| Medium | Production debug/health detail was public | Removed public debug routes and moved detailed storage/migration checks behind administrator authentication |
| Medium | Proxy-derived client IPs were trusted without an explicit proxy list | Disabled trusted proxies by default and added an explicit `TRUSTED_PROXIES` setting |
| Medium | The public contact endpoint had only in-process IP limiting | Added a server-to-server shared secret between the marketing proxy and API |
| Medium | Container privileges and write access were broader than needed | Added a Docker build context ignore file, read-only API root filesystem, dropped capabilities, enabled no-new-privileges, and isolated the application network |
| Medium | Initial migration could destroy existing tables if migration metadata was lost | Removed destructive table/view drops from the initial migration |
| Medium | No automated dependency/security review was configured | Added Dependabot and CodeQL workflows |

## Secret-history scan

A redacted Gitleaks v8.28.0 scan covered 429 commits and reported 38 findings. No secret values are reproduced here. Findings were associated with:

- a historical `api/.env` file;
- historical test result JSON containing JWTs;
- historical test documentation/scripts containing API keys or JWTs;
- historical test certificate/private-key files under `volume/cache/`.

Assume every historical value is compromised, even if it was intended only for testing. Removing a value from the current branch does not invalidate copies in old commits, forks, clones, CI logs, or caches.

## Required actions before professional or sensitive use

### Priority 0 — rotate and deploy

1. Rotate the PostgreSQL user's password in PostgreSQL itself, then update Portainer. Merely changing the Compose variable does not alter an existing database role.
2. Generate and deploy a new JWT secret of at least 32 random bytes. This deliberately invalidates all existing sessions.
3. Revoke/rotate every historical AWS or S3 access key and audit the bucket policy, public-access block, existing object ACLs, and access logs.
4. Replace any certificate/private key found in history if it was used anywhere beyond disposable testing. Delete historical test users/tokens and rotate any reused passwords.
5. Build and push a new API image from this revision, then redeploy the Portainer stack. The public production endpoint was still serving the prior behavior at audit time.
6. Set a separate random `CONTACT_API_SHARED_SECRET` in both the API and marketing deployments. Never expose it through a browser-prefixed environment variable.
7. For the first secure administrator only, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`, deploy once, verify creation, remove both variables, and redeploy.
8. Set `TRUSTED_PROXIES` to only the direct reverse-proxy address/CIDR that connects to the API. Ensure that proxy overwrites forwarded-IP headers. Do not use `0.0.0.0/0`.
9. Firewall the Docker host so PostgreSQL, the API container port, object storage, and Portainer are not directly Internet-accessible. Expose the application only through the TLS reverse proxy; restrict Portainer by VPN/IP allowlist and MFA.
10. Back up PostgreSQL and uploads, encrypt backups, restrict backup access, and perform a restore test before storing real records.

### Priority 0 — GitHub containment

1. Enable GitHub secret scanning, push protection, private vulnerability reporting, branch protection, required CodeQL checks, least-privilege Actions permissions, and MFA for collaborators.
2. After all credentials are rotated, use `git filter-repo` or an equivalent reviewed process to remove the identified files/secrets from every affected ref and force-push the rewritten history.
3. Coordinate the rewrite: invalidate old clones, tell collaborators to re-clone, remove stale release artifacts, and inspect forks. History rewriting reduces casual exposure but cannot retract copies already obtained.

### Priority 1 — remaining design work

- Implement an expiring, single-use invitation/password-reset flow with forced password change. Automatically created client accounts currently receive an unknown random password and cannot log in until such a flow exists.
- Move browser authentication away from JavaScript-readable storage to `Secure`, `HttpOnly`, appropriately scoped cookies with CSRF protection, or use a backend-for-frontend pattern.
- Add refresh-token rotation/revocation and an emergency session-revocation mechanism. Access tokens are currently stateless until expiration or global signing-key rotation.
- Move rate limiting to a shared store or trusted edge layer before horizontal scaling; the current in-memory limiter resets on restart and is per replica.
- Add malware scanning/quarantine for uploaded documents and consider content-disarm/reconstruction for office formats.
- Pin deployed container images by immutable digest or commit tag rather than relying on mutable `latest`, and add container-image scanning/signing to CI.
- Perform a separate infrastructure review of Portainer users, MFA, TLS, Docker socket exposure, host patching, firewall rules, volume permissions, database grants, S3 policy, logs, and backup retention. These cannot be verified from this repository.
- Define data classification, retention/deletion, access-review, incident-response, and audit-log procedures before accepting real family/client records.

## Verification performed

- Go tests and vet (`go test ./...`).
- Official Go vulnerability analysis using Go 1.26.6 (`govulncheck ./...`): zero reachable vulnerabilities.
- Admin portal TypeScript check and Next.js 16.3.1 production build.
- npm advisory scans for admin portal, marketing site, and test harness after updates.
- Marketing production build.
- Flutter formatting/static analysis.
- Docker Compose production configuration validation.
- Redacted full-history secret scan using Gitleaks v8.28.0.

Automated checks reduce risk but are not a penetration test and do not verify the live Portainer host, cloud accounts, or human operational controls.

## Interpreting the unsolicited email

The message offering a license in exchange for a README link is consistent with automated outreach to public GitHub maintainers and link-building. It demonstrates that the sender found the public repository; it is not evidence that they accessed Portainer, the database, uploads, or containers. Do not run attachments or unknown code, share credentials, grant collaborator access, or add a promotional link without independently verifying the company and terms.
