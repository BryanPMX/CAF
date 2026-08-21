<!-- Keyless office map powered by Leaflet and OpenStreetMap. -->
<script>
  import 'leaflet/dist/leaflet.css';
  import { onDestroy, onMount, tick } from 'svelte';
  import { apiUtils } from '$lib/utils/apiClient.js';

  // Initial zoom used for a single office and the Ciudad Juárez fallback.
  export let defaultZoom = 12;
  /** Optional offices supplied by the page so Contacto does not fetch the catalog twice. */
  export let offices = undefined;
  /** Mirrors the page-level loading state when offices are supplied externally. */
  export let loadingOffices = false;

  /** @typedef {{ id: number; name: string; address?: string; latitude?: number | null; longitude?: number | null }} Office */

  const FALLBACK_CENTER = [31.6904, -106.4245];
  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  let mapContainer;
  let map = null;
  let markerLayer = null;
  let leaflet = null;
  let mapInitializationPromise = null;
  let mounted = false;
  let officeList = [];
  let loading = true;
  let error = null;
  let noMarkersShown = false;
  let refreshSequence = 0;

  function usesExternalOffices() {
    return offices !== undefined;
  }

  /** @param {Office} office */
  function hasValidCoords(office) {
    if (
      office.latitude === null ||
      office.latitude === undefined ||
      office.latitude === '' ||
      office.longitude === null ||
      office.longitude === undefined ||
      office.longitude === ''
    ) {
      return false;
    }

    const latitude = Number(office.latitude);
    const longitude = Number(office.longitude);
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /** @param {Office} office */
  function directionsUrl(office) {
    const query = office.address || `${office.latitude},${office.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  /** @param {Office} office */
  function createPopupContent(office) {
    const content = document.createElement('div');
    content.className = 'caf-map-popup';

    const title = document.createElement('strong');
    title.textContent = office.name;
    content.appendChild(title);

    if (office.address) {
      const address = document.createElement('p');
      address.textContent = office.address;
      content.appendChild(address);
    }

    const directions = document.createElement('a');
    directions.href = directionsUrl(office);
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.textContent = 'Cómo llegar';
    content.appendChild(directions);

    return content;
  }

  async function initializeMap() {
    if (!mounted || map || !mapContainer) return;
    if (mapInitializationPromise) return mapInitializationPromise;

    mapInitializationPromise = (async () => {
      try {
        const leafletModule = await import('leaflet');
        if (!mounted || map || !mapContainer) return;

        leaflet = leafletModule.default ?? leafletModule;
        map = leaflet.map(mapContainer, {
          center: FALLBACK_CENTER,
          zoom: defaultZoom,
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true
        });

        leaflet.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19
        }).addTo(map);

        markerLayer = leaflet.layerGroup().addTo(map);
      } catch (mapError) {
        console.error('Error loading office map:', mapError);
        error = 'No se pudo cargar el mapa en este momento.';
      } finally {
        mapInitializationPromise = null;
      }
    })();

    return mapInitializationPromise;
  }

  async function refreshMap() {
    const sequence = ++refreshSequence;
    await tick();
    await initializeMap();

    if (!map || !leaflet || !markerLayer || sequence !== refreshSequence) return;

    markerLayer.clearLayers();
    const mappableOffices = officeList.filter(hasValidCoords);
    noMarkersShown = officeList.length > 0 && mappableOffices.length === 0;

    if (mappableOffices.length === 0) {
      map.setView(FALLBACK_CENTER, defaultZoom);
      map.invalidateSize();
      return;
    }

    const bounds = leaflet.latLngBounds([]);
    const markerIcon = leaflet.divIcon({
      className: 'caf-marker-wrapper',
      html: '<span class="caf-marker" aria-hidden="true"><span></span></span>',
      iconSize: [34, 42],
      iconAnchor: [17, 39],
      popupAnchor: [0, -34]
    });

    for (const office of mappableOffices) {
      const coordinates = [Number(office.latitude), Number(office.longitude)];
      const marker = leaflet.marker(coordinates, {
        icon: markerIcon,
        title: office.name,
        alt: `Ubicación de ${office.name}`
      });
      marker.bindPopup(createPopupContent(office), { maxWidth: 280 });
      marker.addTo(markerLayer);
      bounds.extend(coordinates);
    }

    if (mappableOffices.length === 1) {
      map.setView(bounds.getCenter(), defaultZoom);
    } else {
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: defaultZoom });
    }
    map.invalidateSize();
  }

  $: if (usesExternalOffices()) {
    officeList = Array.isArray(offices) ? offices : [];
    loading = loadingOffices;
  }

  $: mapDataSignature = JSON.stringify(
    officeList.map(({ id, name, address, latitude, longitude }) => ({
      id,
      name,
      address,
      latitude,
      longitude
    }))
  );

  $: if (mounted && !loading && !error) {
    mapDataSignature;
    void refreshMap();
  }

  onMount(async () => {
    mounted = true;

    if (usesExternalOffices()) {
      officeList = Array.isArray(offices) ? offices : [];
      loading = loadingOffices;
      if (!loading) await refreshMap();
      return;
    }

    try {
      officeList = await apiUtils.fetchOffices();
    } catch (fetchError) {
      console.error('Error fetching offices:', fetchError);
      error = 'No se pudieron cargar las ubicaciones.';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    mounted = false;
    refreshSequence += 1;
    map?.remove();
    map = null;
    markerLayer = null;
    mapInitializationPromise = null;
  });
</script>

<div class="office-map-container">
  {#if loading}
    <div class="map-placeholder" role="status" aria-label="Cargando mapa">
      <span class="loading-dot" aria-hidden="true"></span>
      <p>Cargando ubicaciones...</p>
    </div>
  {:else if error}
    <div class="map-placeholder map-error" role="alert">
      <p>{error}</p>
      {#if officeList.length > 0}
        <a href={directionsUrl(officeList[0])} target="_blank" rel="noopener noreferrer">
          Abrir ubicación en Google Maps
        </a>
      {/if}
    </div>
  {:else}
    <div class="map-frame">
      <div
        bind:this={mapContainer}
        class="map-canvas"
        role="application"
        aria-label="Mapa de oficinas del Centro de Apoyo para la Familia"
      ></div>

      {#if noMarkersShown}
        <div class="map-notice" role="status">
          <p>Las ubicaciones aún no tienen coordenadas disponibles.</p>
          {#if officeList.length > 0}
            <a href={directionsUrl(officeList[0])} target="_blank" rel="noopener noreferrer">
              Buscar en Google Maps
            </a>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .office-map-container {
    overflow: hidden;
    border: 1px solid rgb(226 232 240 / 0.9);
    border-radius: 1rem;
    background: #e8f1ee;
    box-shadow: 0 18px 50px -30px rgb(15 23 42 / 0.45);
  }

  .map-frame {
    position: relative;
  }

  .map-canvas,
  .map-placeholder {
    width: 100%;
    height: clamp(21rem, 42vw, 27rem);
    min-height: 21rem;
  }

  .map-canvas {
    z-index: 0;
    background: #e8f1ee;
  }

  .map-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #475569;
    text-align: center;
    background:
      radial-gradient(circle at 25% 20%, rgb(14 165 164 / 0.12), transparent 34%),
      linear-gradient(145deg, #f8fafc, #eef7f5);
  }

  .map-placeholder p {
    margin: 0;
  }

  .map-placeholder a,
  .map-notice a {
    color: #0f766e;
    font-weight: 700;
    text-decoration: none;
  }

  .map-placeholder a:hover,
  .map-notice a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .map-error {
    color: #7f1d1d;
    background: #fff7f7;
  }

  .loading-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    background: #0f766e;
    box-shadow: 0 0 0 0 rgb(15 118 110 / 0.35);
    animation: map-pulse 1.5s infinite;
  }

  .map-notice {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    left: 1rem;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border: 1px solid rgb(255 255 255 / 0.8);
    border-radius: 0.8rem;
    color: #334155;
    background: rgb(255 255 255 / 0.94);
    box-shadow: 0 12px 30px -20px rgb(15 23 42 / 0.5);
    backdrop-filter: blur(10px);
  }

  .map-notice p {
    margin: 0;
  }

  :global(.caf-marker-wrapper) {
    border: 0;
    background: transparent;
  }

  :global(.caf-marker) {
    position: relative;
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 3px solid #fff;
    border-radius: 50% 50% 50% 10%;
    background: #0f766e;
    box-shadow: 0 7px 16px rgb(15 23 42 / 0.28);
    transform: rotate(-45deg);
  }

  :global(.caf-marker span) {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #fff;
  }

  :global(.caf-map-popup) {
    min-width: 190px;
    padding: 0.25rem 0.15rem;
    color: #334155;
    font-family: inherit;
  }

  :global(.caf-map-popup strong) {
    display: block;
    color: #0f172a;
    font-size: 0.95rem;
  }

  :global(.caf-map-popup p) {
    margin: 0.4rem 0 0.65rem;
    color: #64748b;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  :global(.caf-map-popup a) {
    color: #0f766e;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
  }

  :global(.leaflet-control-zoom a) {
    color: #0f766e;
  }

  :global(.leaflet-control-attribution) {
    color: #64748b;
    font-size: 0.65rem;
  }

  @keyframes map-pulse {
    70% {
      box-shadow: 0 0 0 0.75rem rgb(15 118 110 / 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgb(15 118 110 / 0);
    }
  }

  @media (max-width: 640px) {
    .map-canvas,
    .map-placeholder {
      height: 22rem;
      min-height: 22rem;
    }

    .map-notice {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.35rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-dot {
      animation: none;
    }
  }
</style>
