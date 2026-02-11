# COMPLETED: Document Upload – Server-Side Local Storage

> **Status:** Implemented  
> **Date:** 2026-02-10

## Context

The CAF API previously used **AWS S3** exclusively for document uploads (case attachments). In production without AWS, S3 initialization failed and the API continued running—but document upload, download, and delete did not work.

**Solution:** A **Strategy Pattern** implementation that automatically selects between S3 and local filesystem storage at startup.

---

## Architecture (SOLID Principles)

### Strategy Pattern — `FileStorage` Interface

```
storage/
├── storage.go        # FileStorage interface (DIP) + active provider singleton
├── s3.go             # S3 client init (unchanged)
├── s3_adapter.go     # S3Storage — wraps S3 client, implements FileStorage
├── local.go          # LocalStorage — filesystem backend, implements FileStorage
└── local_test.go     # Unit tests (11 tests, 100% pass)
```

| SOLID Principle | Application |
|-----------------|-------------|
| **SRP** | Each storage provider handles one backend only |
| **OCP** | New backends (e.g. GCS, Azure Blob) added as new structs — no existing code changes |
| **LSP** | Both providers are interchangeable via the interface |
| **ISP** | Clean 4-method interface: Upload, Get, Delete, HealthCheck |
| **DIP** | Handlers depend on `FileStorage` interface, not concrete S3/Local types |

---

## Implementation Summary

| Component | Change |
|-----------|--------|
| **api/storage/storage.go** (new) | `FileStorage` interface + `GetActiveStorage()` / `SetActiveStorage()` |
| **api/storage/local.go** (new) | Save to `/app/uploads/cases/{caseID}/{uuid}.ext`, read, delete |
| **api/storage/s3_adapter.go** (new) | Wraps existing S3 client as `FileStorage` implementation |
| **api/storage/local_test.go** (new) | 11 unit tests: upload, get, delete, idempotent delete, path traversal, health check |
| **api/handlers/case_event.go** | `UploadDocument`, `GetDocument`, `DeleteDocument` use `storage.GetActiveStorage()` |
| **api/cmd/server/main.go** | Try S3 first; fallback to LocalStorage; new `/health/storage` endpoint |
| **docker-compose.prod.yml** | Added `caf_uploads` volume mounted at `/app/uploads` |
| **api/Dockerfile** | Create `/app/uploads` directory before switching to non-root user |

**File URL format for local:** `local://cases/{caseID}/{uuid}.ext` (stored in `CaseEvent.FileUrl`).

---

## Startup Behavior

```
1. Try InitS3() + CreateBucketIfNotExists()
   ├─ Success → Use S3Storage as active provider
   └─ Fail → 
2. Create LocalStorage at $UPLOADS_DIR (default: /app/uploads)
   ├─ Success → Use LocalStorage as active provider
   └─ Fail → Document features disabled (WARN logged)
```

---

## Notes

- S3 code remains for environments that use it (e.g. dev with LocalStack).
- AWS SDK stays in `go.mod` for those cases.
- `/health/storage` endpoint reports which backend is active and its health status.
- Legacy `/health/s3` endpoint preserved for backward compatibility.
- Add regular backups of the `caf_uploads` Docker volume in production.
