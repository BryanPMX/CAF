# Property archive

The director's questionnaire was submitted on November 24, 2026. Its answers and
implementation mapping are recorded in [the requirements transcript](requirements/CONSTRUCTORAS_2026-11-24.md),
explicitly included at the project owner's request. The original machine export
remains in the Git-ignored `.local/requirements/constructoras-2026-11-24/`; raw
exports and operational identifiers are not source-code artifacts. The public
questionnaire has been restricted to its owner. Permanent Site deletion is not
exposed by the connected tools.

## Confirmed scope

The requested workflow is to find a person and consult their address, property
portfolio and Public Property Registry information. The archive must include
individual blocks/lots, previous owners, locations, surface area, cadastral keys,
development names, and registry identifiers. It must support judicial districts
throughout Chihuahua. Source information currently exists in Word documents.
The original answers name the people who will concentrate the information, but
do not specify an account-level access policy. Existing management roles and
office boundaries therefore remain authoritative. The first-release priority
question was left unanswered.

A development's name is independent of a company's identity. The examples do
not establish a legal company name or current title merely because a historical
registry screenshot contains a person's name. Do not seed real records, infer
present-day ownership or attach the kilometer-27 location to the first property.

## Delivered workflow

Management roles open **Trabajo → Propiedades**, or the properties panel on an
individual client profile or construction-company record. A property can be
registered without a legal case, with only its name, type and responsible office.
Optional details may be completed later. A property may be related to a
construction company while its development name remains a separate field.

A terreno may contain manzanas or lotes; a manzana may contain lotes. Origin
properties must belong to the same office. Cycles, invalid hierarchy changes,
nonpositive areas and moving an existing archive record to another office are
rejected. Surface areas use square meters and display the equivalent hectares.
Parent/child surface areas are not summed automatically, avoiding double counting.

An optional initial owner is saved in the same transaction as the property, as
**Por confirmar**. Owners may be individuals or canonical company client accounts.
Individual owners must belong to the property's responsible office. Ownership
records carry optional percentages, start/end dates, a source and an explicit
status: **Por confirmar**, **Actual**, or **Histórico**. Existing owner identity
cannot be replaced during an edit; add the next owner and preserve the former
record. Percentages of known current owners cannot exceed 100. The property row
is locked during ownership writes to serialize that check.

Each property can have multiple registry entries. **Folio Real**, **Inscripción**,
**Folio**, **Libro** and **Sección** remain distinct text values, preserving
leading zeroes. Optional instrument number/date, registration date, notary,
act type and source support partial records. Property names, visible owner names, company display/legal/trade names and
registry identifiers are searchable;
no global uniqueness is assumed across districts or historical entries.

Dates are persisted as SQL DATE and serialized as `YYYY-MM-DD`, without timezone
shifts. An optional client birth date supports automatically calculated age on
the managed profile; the existing personal-address field is now displayed there.
Omitting a birth date in an older API request preserves it; an empty string
explicitly clears it. Private birth/address fields are not added to self-profile
or workflow selector responses.

Constructoras distinguish display name, legal name and commercial name. Display
name remains the required directory identifier and stays synchronized with the
canonical company account. Legal details can be completed later. A linked person
may have several explicit roles: owner, partner, sole trader, legal representative
or contact, plus a note. These roles never establish ownership of a property.
Omitted relationship fields preserve existing details when a client is linked
again; explicit empty values clear them.

Documents use the existing injected `FileStorage` interface, content/type/size
validation and private authenticated download routes. Uploads are limited to
25 MiB, storage paths are never exposed, and failed metadata writes clean up the
uploaded file. No fabricated expediente is created for a document.

## Access and API

Only Administrador, Director Ejecutivo and Soporte Tecnico may use the archive.
Office administrators see only their office's property records; global roles
see all. A shared company link never grants access to another office's archive.
If a person later moves office, their name is masked in old-office ownership
responses. Hard deletion is rejected for users referenced as owners or archive
authors; disabling an account preserves that history. Document retrieval repeats the property authorization check.

All routes are under authenticated `/api/v1`:

| Method and route | Behavior |
| --- | --- |
| `GET /properties` | Search; `q`, `officeId`, `organizationId`, `clientId`, `page`, `pageSize` (default 20, max 100) |
| `POST /properties` | Create property; optional `initialOwnerId` creates a reported ownership atomically |
| `GET /properties/:id` | Property with ownership history, registry entries and document metadata |
| `PUT /properties/:id` | Full property form update; office is immutable |
| `POST /properties/:id/owners` | Add ownership record |
| `PUT /properties/:id/owners/:ownerId` | Correct an ownership record or mark it historical |
| `POST /properties/:id/registry` | Add registry entry |
| `PUT /properties/:id/registry/:entryId` | Correct registry entry |
| `POST /properties/:id/documents` | Upload multipart `file` |
| `GET /properties/:id/documents/:documentId` | Authenticated attachment download |

Property API responses use `Cache-Control: private, no-store`. Subresource IDs
must belong to the requested property. Role and office checks are implemented in
the service layer as well as the authenticated HTTP entry points. Caller-supplied
IDs, creation authors and timestamps cannot override server-owned metadata.

## Deployment and validation

Deploy API and portal together. Migration `0068_property_archive.sql` adds only
nullable/defaulted fields and new archive tables/indexes; it preserves existing
users, companies, memberships, cases and appointments. It is safe to replay.
Take the normal database and upload-volume backup before deploying. Keep the
existing upload volume mounted. No production records were inserted by this task.

`NEXT_PUBLIC_API_URL` must be supplied **during the portal build**, because the
browser bundle needs the deployment's API URL. For an isolated local release check:

```sh
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1 npm --prefix admin-portal run build
npm --prefix admin-portal run start -- --port 3100 --hostname 127.0.0.1
```

See [testing instructions](../testing/README.md#property-archive-validation) for
Go, browser, production-image/PostgreSQL and temporary-tunnel verification.

## UI and interaction consistency

The directory uses the same page heading, spacing, Ant Design controls, tables,
drawers and forms as Constructoras. Client identity appears before the related
property archive. Detail tabs survive saves and refreshes without blanking the
loaded record. Offices and associated construction companies are identified by
name. Empty, loading, error and download states use Mexican Spanish. Dates are
formatted for `es-MX` without shifting the stored calendar day.

Forms protect unsaved edits when canceled and cannot be dismissed while a save
is in progress. Mobile forms use the same controls and stack fields vertically;
wide record tables scroll within their containers. Form bodies reserve space for
the grid gutters and vertical scrollbar, with a separated action footer and
height based on the available viewport; fields do not scroll horizontally.
The browser suite checks the
mobile editor, keyboard cancellation, owner preselection, registry-tab retention
and field-level validation in addition to the normal capture workflow.

## Boundaries of this release

The web portal and shared API implement this workflow. A native Flutter property
editor, automatic extraction or bulk import from Word, a separately managed
fraccionamiento directory, and a single cross-property escritura catalog are
not implemented. Instrument details currently belong to each property registry
entry. Word files can be attached as source documents. Real records still require
staff capture and verification. The named source contacts have not been converted
into new permissions or user accounts.
