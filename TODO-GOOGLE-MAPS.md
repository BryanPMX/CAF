# TODO: Google Maps Feature

## Current State

- **Location:** `marketing/src/routes/contacto/+page.svelte`
- **Issue:** Map uses a placeholder/dummy embed URL (`mid=1_c1b2g4s3f5e6g7h8i9j0k1l2m3n4o5`) that does not show real CAF office locations
- **ContactInfo:** Shows generic address "Ciudad Juárez, Chihuahua" and mentions "5 oficinas" in meta description
- **Source of truth:** Offices are managed in the **admin portal** (App → Offices). The API already has `GET /offices` but it requires auth.

---

## Data Flow (intended)

```
Admin Portal (App → Offices)  →  API (offices table)  →  Marketing contact page (map)
     Admin adds/edits offices         GET /public/offices           Fetch & display markers
```

---

## Tasks

### 1. Public API Endpoint

- [x] **Add `GET /api/v1/public/offices`** – returns all offices (no auth required)
  - Marketing site is public; it cannot use `/admin/offices` or `/manager/offices` which require JWT
  - Response: `[{ id, name, address, code }, ...]`
  - Filter out soft-deleted offices (`deleted_at IS NULL`)

### 2. Office Model (optional but recommended)

- [x] **Add `latitude` and `longitude`** to Office model for precise map markers
  - Current model: `id`, `name`, `address`, `code`
  - With lat/lng: no geocoding needed; map can place markers directly
  - Without: use address + Google Geocoding API (client-side) to convert address → coordinates
- [x] Update admin `OfficeModal` so admins can set lat/lng when creating/editing offices (or add a "Get from address" button that calls Geocoding)

### 3. Marketing Site – Fetch Offices

- [x] In `contacto/+page.svelte` (or a new `OfficeMap.svelte` component):
  - Fetch offices from `GET {VITE_API_URL}/public/offices`
  - Use `marketing/src/lib/utils/apiClient.js` or a dedicated `fetchOffices()` function
  - Handle loading and error states

### 4. Google Maps Integration

- [x] **Option B – Maps JavaScript API (dynamic, recommended)** – implemented
- [ ] **Option A – Google My Maps (simplest, no API key)**  
  - Create a custom map at [Google My Maps](https://www.google.com/maps/d/)
  - Add markers for each office (use addresses from API or admin)
  - Publish → Share → Embed → replace placeholder iframe URL
  - **Limitation:** Map is manual; won't auto-update when admin adds/edits offices

- [x] **Option B – Maps JavaScript API (dynamic, recommended)**  
  - Enable **Maps JavaScript API** in Google Cloud Console
  - Add `VITE_GOOGLE_MAPS_API_KEY` to marketing env
  - Create a Svelte component that:
    - Fetches offices from API
    - Renders map with markers (use `address` + Geocoding, or `latitude`/`longitude` if added)
    - Shows office name and address in info window on marker click
  - Map updates automatically when admin adds/edits offices

### 5. Implementation

- [x] Replace placeholder iframe in `marketing/src/routes/contacto/+page.svelte` (lines 150–159)
- [x] Use Option A (static embed) or Option B (dynamic map from API)
- [x] Add `VITE_GOOGLE_MAPS_API_KEY` to marketing env if using Option B
- [x] Add `VITE_API_URL` to marketing env (API base URL for fetching offices)

### 6. Optional Enhancements

- [x] Add "Abrir en Google Maps" link next to the map (in marker info window and fallback when API key missing)
- [ ] Make address in ContactInfo clickable (opens in Maps)
- [ ] Add loading or fallback if map fails to load
- [ ] Sync ContactInfo with API (e.g. primary office address) or keep separate for general contact

---

## Reference

- **API:** `api/handlers/offices.go` – `GetOffices` (currently auth-protected)
- **Office model:** `api/models/office.go` – `id`, `name`, `address`, `code`
- **Admin offices page:** `admin-portal/src/app/(dashboard)/app/offices/page.tsx`
- **Marketing contact:** `marketing/src/routes/contacto/+page.svelte`
- **Env:** `marketing/env.example` → `VITE_GOOGLE_MAPS_API_KEY`, `VITE_API_URL`

---

## Recommendation

Use **Option B (Maps JavaScript API + public offices endpoint)** so the map reflects offices managed in the admin portal and stays in sync when admins add or edit locations.
