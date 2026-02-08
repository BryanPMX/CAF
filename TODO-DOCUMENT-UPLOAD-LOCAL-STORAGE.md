# TO-DO: Document Upload – Server-Side Local Storage

## Context

The CAF API currently uses **AWS S3** for document uploads (case attachments). In production without AWS, S3 initialization fails and the API continues running—but document upload, download, and delete do not work.

**Goal:** Use **server-side local storage** (files on the Ubuntu server in a Docker volume) instead of S3 when AWS is not configured.

---

## Current Behavior

| Operation | Current Implementation |
|-----------|------------------------|
| **Upload** | `storage.UploadFile()` → S3 → returns URL |
| **Get** | `s3Client.GetObject()` → streams file to response |
| **Delete** | `s3Client.DeleteObject()` → removes from S3 |

---

## Proposed Implementation

When S3 is not configured (`GetS3Client() == nil`), use local filesystem on the server.

| Component | Change |
|-----------|--------|
| **api/storage/local.go** (new) | Save to `/app/uploads/cases/{caseID}/{uuid}.ext`, read, delete |
| **api/storage/** | Add helper to choose S3 vs local based on `GetS3Client() == nil` |
| **api/handlers/case_event.go** | `UploadDocument`: use local when S3 is nil; `GetDocument` and `DeleteDocument`: handle local paths |
| **docker-compose.prod.yml** | Add volume for `/app/uploads` |
| **api/cmd/server/main.go** | Create `/app/uploads` directory on startup if using local storage |

**File URL format for local:** e.g. `local://cases/123/uuid.pdf` (stored in `CaseEvent.FileUrl`).

---

## Scope

- **UploadDocument** – Save file to server disk, store local path in DB
- **GetDocument** – Read file from disk, stream to response
- **DeleteDocument** – Remove file from disk when deleting record

---

## Notes

- S3 code remains for environments that use it (e.g. dev with LocalStack).
- AWS SDK stays in `go.mod` for those cases.
- Add regular backups of the uploads volume in production.
