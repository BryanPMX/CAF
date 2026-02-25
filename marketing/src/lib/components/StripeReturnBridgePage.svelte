<script>
  import { onMount } from 'svelte';

  export let status = 'success'; // "success" | "cancel"
  export let title = 'Regresando a la app';
  export let subtitle = 'Estamos abriendo CAF Cliente.';
  export let badge = 'Stripe Checkout';
  export let icon = '↗';

  const APP_SCHEME = 'cafclient';
  const FALLBACK_TIMEOUT_MS = 1600;

  let deepLink = '';
  let caseId = '';
  let sessionId = '';
  let attempted = false;
  let showFallback = false;
  let hiddenDuringAttempt = false;
  let fallbackTimer;

  function buildDeepLinkFromLocation() {
    if (typeof window === 'undefined') return '';
    const current = new URL(window.location.href);
    caseId = current.searchParams.get('case_id') ?? '';
    sessionId = current.searchParams.get('session_id') ?? '';

    const next = new URL(`${APP_SCHEME}://payments/${status === 'cancel' ? 'cancel' : 'success'}`);
    for (const [key, value] of current.searchParams.entries()) {
      next.searchParams.set(key, value);
    }
    next.searchParams.set('source', 'marketing-stripe-return');
    return next.toString();
  }

  function scheduleFallback() {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (!hiddenDuringAttempt) {
        showFallback = true;
      }
    }, FALLBACK_TIMEOUT_MS);
  }

  function openApp() {
    if (!deepLink || typeof window === 'undefined') return;
    attempted = true;
    showFallback = false;
    hiddenDuringAttempt = false;
    scheduleFallback();
    window.location.href = deepLink;
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    deepLink = buildDeepLinkFromLocation();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenDuringAttempt = true;
        clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    openApp();

    return () => {
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
</script>

<section class="relative px-6 py-10 sm:py-14">
  <div class="mx-auto max-w-3xl">
    <div class="glass-panel rounded-3xl p-6 sm:p-8">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center rounded-full border border-blue-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-800">
          {badge}
        </span>
        <span
          class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold {status === 'success'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-amber-100 text-amber-800'}"
        >
          {status === 'success' ? 'Pago completado' : 'Pago cancelado'}
        </span>
      </div>

      <div class="grid gap-6 sm:grid-cols-[1.2fr_0.8fr] sm:items-start">
        <div>
          <h1 class="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p class="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{subtitle}</p>

          <div class="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
            <p class="text-sm text-slate-600">
              La aplicación móvil CAF Cliente es el canal principal para el seguimiento del pago y los recibos. Si la app no se abre automáticamente, usa el botón de abajo.
            </p>

            <div class="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                on:click={openApp}
                class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Abrir app {icon}
              </button>

              <a
                href="/"
                class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Volver al sitio
              </a>
            </div>
          </div>

          {#if showFallback}
            <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700">
              <p class="font-semibold">No se abrió la app automáticamente.</p>
              <p class="mt-1">
                Verifica que CAF Cliente esté instalada en este dispositivo y vuelve a intentar con “Abrir app”.
              </p>
              {#if deepLink}
                <p class="mt-2 break-all text-xs text-slate-500">{deepLink}</p>
              {/if}
            </div>
          {/if}
        </div>

        <div class="card-lift rounded-2xl bg-white/85 p-4">
          <div class="text-sm font-semibold text-slate-900">Detalle de retorno</div>
          <dl class="mt-3 space-y-3 text-sm">
            <div>
              <dt class="text-slate-500">Estado</dt>
              <dd class="font-medium text-slate-800">
                {status === 'success' ? 'Exitoso (pendiente de confirmación del servidor)' : 'Cancelado por el usuario'}
              </dd>
            </div>
            <div>
              <dt class="text-slate-500">Caso</dt>
              <dd class="font-medium text-slate-800">{caseId || 'No especificado'}</dd>
            </div>
            <div>
              <dt class="text-slate-500">Sesión Stripe</dt>
              <dd class="break-all font-medium text-slate-800">{sessionId || 'No especificada'}</dd>
            </div>
            <div>
              <dt class="text-slate-500">Intento automático</dt>
              <dd class="font-medium text-slate-800">{attempted ? 'Sí' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</section>

