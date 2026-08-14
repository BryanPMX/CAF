# Security Policy

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, personal record, or exploit in a public issue or discussion.

Use GitHub's private vulnerability reporting for this repository. If that option is unavailable, contact the repository owner privately with only enough initial detail to establish a secure communication channel. Include affected versions, reproduction steps, impact, and any suggested mitigation after a private channel is established.

Never include live credentials or personal information in a report. Revoke or rotate any credential that may have been exposed before sharing diagnostic material.

## Supported version

Only the current default branch is maintained. A source-code fix is not effective in production until the API image and web applications have been rebuilt and the Portainer stack has been redeployed.

## Deployment responsibility

Runtime data and secrets are outside this Git repository. Operators are responsible for securing Portainer, the Docker host, named volumes, backups, the reverse proxy, cloud storage, and GitHub repository settings. Follow the deployment checklist in `docs/SECURITY_AUDIT_2026-08-14.md`.
