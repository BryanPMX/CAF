<!-- marketing/src/lib/components/OfficeMap.svelte -->
<!-- Dynamic Google Maps component that fetches offices from API and displays markers -->
<script>
  import { onMount, tick } from 'svelte';
  import { apiUtils } from '$lib/utils/apiClient.js';

  /** @type {string} */
  export let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  /** Optional Map ID from Google Cloud (required for Advanced Markers); if unset, legacy Marker is used */
  /** @type {string} */
  export let mapId = import.meta.env.VITE_GOOGLE_MAP_ID || '';
  /** @type {number} */
  export let defaultZoom = 12;

  let mapContainer;
  let map = null;
  let offices = [];
  let loading = true;
  let error = null;
  let mapLoaded = false;
  /** When true: we have offices but no markers could be placed (no coords and geocoding failed or no address) */
  let noMarkersShown = false;

  /** @typedef {{ id: number; name: string; address: string; latitude?: number | null; longitude?: number | null }} Office */

  /** Only treat as valid when both coordinates are finite numbers (handles undefined, null, strings from API) */
  function hasValidCoords(o) {
    const lat = Number(o.latitude);
    const lng = Number(o.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  onMount(async () => {
    if (!apiKey) {
      error = 'Google Maps API key no configurado (VITE_GOOGLE_MAPS_API_KEY)';
      loading = false;
      return;
    }

    try {
      offices = await apiUtils.fetchOffices();
    } catch (e) {
      console.error('Error fetching offices:', e);
      error = 'No se pudieron cargar las oficinas.';
      loading = false;
      return;
    } finally {
      loading = false;
    }

    await tick();
    loadGoogleMaps();
  });

  function loadGoogleMaps() {
    if (window.google?.maps) {
      initMap();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=window.__cafMapInit`;
    script.async = true;
    script.defer = true;
    window.__cafMapInit = () => {
      initMap();
      delete window.__cafMapInit;
    };
    document.head.appendChild(script);
  }

  async function initMap() {
    if (!mapContainer || !window.google?.maps) return;

    const center = getMapCenter();
    const mapOptions = {
      center,
      zoom: defaultZoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };
    if (mapId) {
      mapOptions.mapId = mapId;
    }
    map = new google.maps.Map(mapContainer, mapOptions);

    const markersAdded = await addMarkers();
    if (offices.length > 0 && markersAdded === 0) {
      noMarkersShown = true;
    }
    mapLoaded = true;
  }

  function getMapCenter() {
    const withCoords = offices.filter((o) => hasValidCoords(o));
    if (withCoords.length > 0) {
      const avgLat = withCoords.reduce((s, o) => s + Number(o.latitude), 0) / withCoords.length;
      const avgLng = withCoords.reduce((s, o) => s + Number(o.longitude), 0) / withCoords.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 31.6904, lng: -106.4245 };
  }

  function openInfoFor(office, anchor, infowindowRef) {
    const content = `
      <div style="padding: 8px; min-width: 180px;">
        <strong>${escapeHtml(office.name)}</strong>
        <p style="margin: 6px 0 0; font-size: 13px; color: #555;">${escapeHtml(office.address || '')}</p>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          office.address || `${office.latitude},${office.longitude}`
        )}" target="_blank" rel="noopener noreferrer" style="margin-top: 6px; display: inline-block; font-size: 12px; color: #1976d2;">Abrir en Google Maps</a>
      </div>
    `;
    infowindowRef.setContent(content);
    infowindowRef.open(map, anchor);
  }

  /** Returns the number of markers added. */
  async function addMarkers() {
    const geocoder = new google.maps.Geocoder();
    const infowindow = new google.maps.InfoWindow();
    let count = 0;

    const addOne = (office, position) => {
      count += 1;
      return position;
    };

    if (mapId) {
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
      const addMarkerAt = (office, position) => {
        addOne(office, position);
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: office.name
        });
        marker.addListener('gmp-click', () => {
          infowindow.close();
          openInfoFor(office, marker, infowindow);
        });
      };
      for (const office of offices) {
        if (hasValidCoords(office)) {
          addMarkerAt(office, { lat: Number(office.latitude), lng: Number(office.longitude) });
        } else if (office.address) {
          await new Promise((resolve) => {
            geocoder.geocode({ address: office.address }, (results, status) => {
              if (status === 'OK' && results?.[0]?.geometry?.location) {
                addMarkerAt(office, results[0].geometry.location);
              }
              resolve();
            });
          });
        }
      }
      return count;
    }

    for (const office of offices) {
      if (hasValidCoords(office)) {
        const position = { lat: Number(office.latitude), lng: Number(office.longitude) };
        addOne(office, position);
        const marker = new google.maps.Marker({ map, position, title: office.name });
        marker.addListener('click', () => {
          infowindow.close();
          openInfoFor(office, marker, infowindow);
        });
      } else if (office.address) {
        await new Promise((resolve) => {
          geocoder.geocode({ address: office.address }, (results, status) => {
            if (status === 'OK' && results?.[0]?.geometry?.location) {
              addOne(office, results[0].geometry.location);
              const marker = new google.maps.Marker({
                map,
                position: results[0].geometry.location,
                title: office.name
              });
              marker.addListener('click', () => {
                infowindow.close();
                openInfoFor(office, marker, infowindow);
              });
            }
            resolve();
          });
        });
      }
    }
    return count;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
</script>

<div class="office-map-container">
  {#if loading}
    <div class="map-placeholder" role="status" aria-label="Cargando mapa">
      <p>Cargando mapa...</p>
    </div>
  {:else if error}
    <div class="map-placeholder map-error" style="flex-direction: column; gap: 0.5rem;">
      <p>{error}</p>
      {#if offices.length > 0}
        <a
          href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(offices[0].address || 'Ciudad Juárez, Chihuahua')}"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-600 hover:underline text-sm"
        >
          Abrir ubicaciones en Google Maps
        </a>
      {/if}
    </div>
  {:else}
    {#if noMarkersShown}
      <div class="map-placeholder map-warning" role="status">
        <p>No se pudieron ubicar las oficinas en el mapa (faltan coordenadas o la dirección no pudo geocodificarse).</p>
        {#if offices.length > 0}
          <a
            href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(offices[0].address || 'Ciudad Juárez, Chihuahua')}"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 hover:underline text-sm mt-2 inline-block"
          >
            Abrir ubicaciones en Google Maps
          </a>
        {/if}
      </div>
    {:else}
      <div
        bind:this={mapContainer}
        class="map-canvas"
        style="width: 100%; height: 480px; min-height: 300px;"
        role="application"
        aria-label="Mapa de oficinas del Centro de Apoyo para la Familia"
      ></div>
    {/if}
  {/if}
</div>

<style>
  .office-map-container {
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  .map-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    background: #f3f4f6;
    color: #6b7280;
  }

  .map-placeholder.map-error {
    background: #fef2f2;
    color: #991b1b;
  }

  .map-placeholder.map-warning {
    flex-direction: column;
    gap: 0.5rem;
    background: #fffbeb;
    color: #92400e;
  }

  .map-canvas {
    background: #e5e7eb;
  }
</style>
