<!-- marketing/src/lib/components/OfficeMap.svelte -->
<!-- Dynamic Google Maps component that fetches offices from API and displays markers -->
<script>
  import { onMount, tick } from 'svelte';
  import { apiUtils } from '$lib/utils/apiClient.js';

  /** @type {string} */
  export let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  /** @type {number} */
  export let defaultZoom = 12;

  let mapContainer;
  let map = null;
  let offices = [];
  let loading = true;
  let error = null;
  let mapLoaded = false;

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

  function initMap() {
    if (!mapContainer || !window.google?.maps) return;

    const center = getMapCenter();
    map = new google.maps.Map(mapContainer, {
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
    });

    addMarkers();
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

  function addMarkers() {
    const geocoder = new google.maps.Geocoder();
    const infowindow = new google.maps.InfoWindow();

    offices.forEach((office) => {
      if (hasValidCoords(office)) {
        addMarkerAt(office, { lat: Number(office.latitude), lng: Number(office.longitude) }, infowindow);
      } else if (office.address) {
        geocoder.geocode({ address: office.address }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            addMarkerAt(office, results[0].geometry.location, infowindow);
          }
        });
      }
    });
  }

  function addMarkerAt(office, position, infowindow) {
    // Prefer AdvancedMarkerElement when a mapId is available: google.maps.importLibrary('marker') then new google.maps.marker.AdvancedMarkerElement
    const marker = new google.maps.Marker({
      map,
      position,
      title: office.name
    });

    marker.addListener('click', () => {
      infowindow.close();
      const content = `
        <div style="padding: 8px; min-width: 180px;">
          <strong>${escapeHtml(office.name)}</strong>
          <p style="margin: 6px 0 0; font-size: 13px; color: #555;">${escapeHtml(office.address || '')}</p>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            office.address || `${office.latitude},${office.longitude}`
          )}" target="_blank" rel="noopener noreferrer" style="margin-top: 6px; display: inline-block; font-size: 12px; color: #1976d2;">Abrir en Google Maps</a>
        </div>
      `;
      infowindow.setContent(content);
      infowindow.open(map, marker);
    });
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
    <div
      bind:this={mapContainer}
      class="map-canvas"
      style="width: 100%; height: 480px; min-height: 300px;"
      role="application"
      aria-label="Mapa de oficinas del Centro de Apoyo para la Familia"
    ></div>
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

  .map-canvas {
    background: #e5e7eb;
  }
</style>
