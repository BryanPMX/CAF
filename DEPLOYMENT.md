# CAF Backend - Production Deployment (Portainer + Docker Hub)

## Prerequisites

1. **GitHub Actions secrets** (Repository Settings → Secrets and variables → Actions):
   - `DOCKERHUB_USERNAME` – Your Docker Hub username (e.g. `brpmx`)
   - `DOCKERHUB_TOKEN` – Docker Hub access token (create at hub.docker.com → Account Settings → Security → New Access Token)

2. **First image**: Push to `main` (with changes in `api/`) or run the workflow manually. This builds and pushes `brpmx/caf-api:latest` to Docker Hub.

---

## Step 1: Portainer Stack

1. In Portainer: **Stacks** → **Add Stack**
2. Name: `caf` (or your preference)
3. **Web editor** – paste the contents of `docker-compose.prod.yml`
4. Enable **Environment variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_USER` | `caf_user` | Strong, unique |
| `DB_PASSWORD` | *(generate)* | `openssl rand -base64 24` |
| `DB_NAME` | `caf_db` | Default |
| `JWT_SECRET` | *(generate)* | `openssl rand -base64 32` |
| `DB_SSLMODE` | `disable` | Or `require` if using TLS |
| `RATE_LIMIT_REQUESTS` | `500` | Optional |
| `RATE_LIMIT_DURATION_MINUTES` | `1` | Optional |

5. **Deploy** the stack.

---

## Step 2: Nginx Proxy Manager

1. Open NPM (e.g. `http://your-server-ip:81`)
2. **Hosts** → **Proxy Hosts** → **Add Proxy Host**
3. **Details**:
   - **Domain names**: `api.caf-mexico.com`
   - **Scheme**: `http`
   - **Forward hostname / IP**: `caf-api-1` (Docker container name)
   - **Forward port**: `8080`
   - **Cache assets**: Optional
4. **SSL**:
   - Enable SSL
   - Force SSL
   - Use Let’s Encrypt or your SSL certificate
5. Save.

---

## Step 3: Cloudflare

1. In Cloudflare: DNS → Add record for `api.caf-mexico.com`
2. If using Cloudflare Tunnel: Configure tunnel to route `api.caf-mexico.com` to NPM (or your chosen target).

---

## Step 4: Verify

```bash
curl https://api.caf-mexico.com/health
# Expected: {"status":"healthy","service":"CAF API",...}
```

---

## CORS Origins

Configured in the compose file for:

- `https://admin.caf-mexico.org`, `https://admin.caf-mexico.com`
- `https://caf-mexico.org`, `https://www.caf-mexico.org`
- `https://caf-mexico.com`, `https://www.caf-mexico.com`

Add more in `CORS_ALLOWED_ORIGINS` if needed.

---

## Image Updates

After new pushes to `main` (with `api/` changes), the workflow builds and pushes a new `brpmx/caf-api:latest`.

To update on the server:

1. Portainer → **Stacks** → `caf` → **Editor**
2. Click **Update the stack**
3. Or: **Containers** → `caf-api-1` → **Recreate** (this pulls the new image).

---

## Security Notes

- Do not expose PostgreSQL port on the host
- Do not expose the API port on the host; use NPM proxy
- Use strong, unique `JWT_SECRET` and `DB_PASSWORD`
- Keep the API image updated (pull latest after CI builds)
