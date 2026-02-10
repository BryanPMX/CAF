# Google Maps Feature – Contact Page

## Current State ✅

- **Contact page:** `marketing/src/routes/contacto/+page.svelte` uses the dynamic `<OfficeMap />` component.
- **Map:** Fetches offices from `GET /api/v1/public/offices`, shows markers for offices with valid `latitude`/`longitude`; falls back to Google Geocoding by address when coords are missing.
- **Source of truth:** Offices (including lat/lng) are managed in **Admin Portal → App → Offices** (`admin-portal/src/app/(dashboard)/app/offices/`).
- **Public API:** `GET /api/v1/public/offices` returns all non-deleted offices (no auth). Response includes `id`, `name`, `address`, `code`, `latitude`, `longitude` (lat/lng omitted when null).

---

## Data Flow

```
Admin Portal (App → Offices)  →  API (offices table)  →  Marketing contact page (map)
     Admin adds/edits offices    GET /public/offices    OfficeMap fetches & displays markers
```

---

## Completed Tasks

### 1. Public API Endpoint
- [x] **`GET /api/v1/public/offices`** – returns all offices, no auth
  - Filters soft-deleted offices (`deleted_at IS NULL`)
  - Response: `[{ id, name, address, code, latitude?, longitude?, ... }]`

### 2. Office Model
- [x] **`latitude` and `longitude`** on Office model (`api/models/office.go`)
- [x] Admin **OfficeModal** lets admins set lat/lng when creating/editing offices

### 3. Marketing Site – Fetch & Map
- [x] **OfficeMap.svelte** fetches from `GET {VITE_API_URL}/public/offices` via `apiUtils.fetchOffices()`
- [x] Response normalized (array or `{ data: array }`); lat/lng coerced to numbers
- [x] Map shows markers for offices with valid coords; geocoding fallback when address exists but coords missing
- [x] Loading and error states; "Abrir en Google Maps" in marker info window and error fallback

### 4. Google Maps Integration
- [x] **Maps JavaScript API** (Option B) – dynamic map, markers, info windows
- [x] `VITE_GOOGLE_MAPS_API_KEY` and `VITE_API_URL` in marketing env

### 5. Optional (done)
- [x] "Abrir en Google Maps" link in marker popup and when map errors

---

## Future Enhancements

### Easy lat/lng lookup for admins (recommended)

Make it easier for users to fill latitude/longitude in the office form:

1. **"Obtener desde dirección" button** ✅ *Done*  
   - In **OfficeModal**, button "Obtener coordenadas desde dirección" under the address field calls **Google Geocoding API** and fills Latitud/Longitud with the first result.
   - **Requires:** Geocoding API enabled in Google Cloud, and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the admin portal `.env.local` (see admin-portal README).
   - **UX:** User types or pastes address → clicks button → lat/lng are filled; they can adjust and save.

2. **"Abrir en Google Maps" link next to address** ✅ *Done*  
   - In **OfficeModal**, a link under the address field opens Google Maps with the current address (or "Ciudad Juárez, Chihuahua" if empty).
   - User finds the pin, right-click the map → "What’s here?" or click the coordinates in the URL to copy lat/lng, then pastes into Latitud/Longitud.
   - No backend or API key needed.

3. **Make lat/lng optional in the form**  
   - Marketing map already geocodes by address when lat/lng are missing. You can make lat/lng optional in the modal (remove "required" rule) and add help text: "Opcional. Si no se llenan, el mapa intentará ubicar la oficina por la dirección."

### Other optional improvements

- [ ] Make address in **ContactInfo** clickable (opens in Google Maps).
- [ ] Add loading or fallback UI if the map script fails to load.
- [ ] Sync **ContactInfo** with API (e.g. show primary office address from `GET /public/offices`) or keep it separate for general contact.

---

## Reference

| Item | Path or value |
|------|----------------|
| **Public offices API** | `GET /api/v1/public/offices` – no auth |
| **API handler** | `api/handlers/offices.go` – `GetPublicOffices` |
| **Office model** | `api/models/office.go` – `id`, `name`, `address`, `code`, `latitude`, `longitude` |
| **Admin offices page** | `admin-portal/src/app/(dashboard)/app/offices/page.tsx` |
| **Office modal** | `admin-portal/src/app/(dashboard)/app/offices/components/OfficeModal.tsx` |
| **Marketing contact page** | `marketing/src/routes/contacto/+page.svelte` |
| **Office map component** | `marketing/src/lib/components/OfficeMap.svelte` |
| **Fetch offices** | `marketing/src/lib/utils/apiClient.js` – `apiUtils.fetchOffices()` |
| **Marketing env** | `marketing/env.example` – `VITE_GOOGLE_MAPS_API_KEY`, `VITE_API_URL` |

**Production API base (example):** `https://api.caf-mexico.com/api/v1` – ensure `VITE_API_URL` in the marketing site matches your deployed API.

---

## Verification checklist

- [ ] `GET {API_BASE}/public/offices` returns 200 and a JSON array with offices; offices that should show on the map have numeric `latitude` and `longitude`.
- [ ] Marketing env has `VITE_API_URL` and `VITE_GOOGLE_MAPS_API_KEY` set.
- [ ] Contact page loads the map and shows one marker per office that has valid coords (or geocoded from address).
- [ ] Admin can create/edit offices with lat/lng; same values appear in the public API response and on the map.
