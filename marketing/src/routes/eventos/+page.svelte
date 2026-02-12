<script>
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  export let data;

  function onImageError(e) {
    const el = e?.target;
    if (el) {
      el.style.display = 'none';
      const parent = el.parentElement;
      if (parent) {
        parent.classList.add('!w-0', '!min-w-0', '!min-h-0', 'overflow-hidden', '!p-0');
      }
    }
  }
</script>

<svelte:head>
  <title>Próximos Eventos - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Participe en nuestros talleres, pláticas y eventos comunitarios." />
</svelte:head>

<section class="hero-wave-scene relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-[#8d6bf7] py-16 text-white md:py-24">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.22),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(221,191,255,0.32),transparent_38%)]"></div>
  <div class="container relative z-10 mx-auto px-6 text-center">
    <h1 class="mb-4 text-4xl font-extrabold leading-tight md:text-5xl" in:fade={{ duration: 800, easing: cubicOut }}>
      Calendario de Eventos
    </h1>
    <p class="mx-auto max-w-3xl text-lg text-primary-100 md:text-xl" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
      Únase a nosotros para aprender, crecer y conectar con su comunidad.
    </p>
  </div>
  <div class="hero-wave-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 220" preserveAspectRatio="none" class="hero-wave-svg hero-wave-back h-28 w-full md:h-40 lg:h-44">
      <path class="hero-wave-path-back" d="M0,128L60,138.7C120,149,240,171,360,170.7C480,171,600,149,720,133.3C840,117,960,107,1080,112C1200,117,1320,139,1380,149.3L1440,160L1440,220L0,220Z"></path>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 220" preserveAspectRatio="none" class="hero-wave-svg hero-wave-front w-full h-24 md:h-36 lg:h-40">
      <path class="hero-wave-path-front" d="M0,128L60,138.7C120,149,240,171,360,170.7C480,171,600,149,720,133.3C840,117,960,107,1080,112C1200,117,1320,139,1380,149.3L1440,160L1440,220L0,220Z"></path>
    </svg>
  </div>
</section>

<section class="py-20 bg-[radial-gradient(circle_at_16%_16%,rgba(141,107,247,0.18),transparent_35%),radial-gradient(circle_at_86%_14%,rgba(56,120,214,0.16),transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8f1ff_52%,#edf6ff_100%)]">
  <div class="max-w-5xl mx-auto px-6">
    {#if data.events.length > 0}
      <div class="space-y-6">
        {#each data.events as event, i}
          <div
            class="rounded-2xl overflow-hidden card-lift"
            in:slide={{ duration: 600, delay: i * 100, easing: cubicOut }}
          >
            <div class="flex flex-col md:flex-row min-h-[180px]">
              <!-- Event image (from URL) -->
              {#if event.imageUrl && event.imageUrl.trim()}
                <div class="md:w-48 lg:w-56 flex-shrink-0 bg-gray-100 min-h-[160px] md:min-h-[180px]">
                  <img
                    src={event.imageUrl}
                    alt={event.title || 'Evento'}
                    class="w-full h-full min-h-[160px] md:min-h-[180px] object-cover"
                    onerror={onImageError}
                  />
                </div>
              {/if}
              <!-- Date strip -->
              <div class="flex-shrink-0 w-full md:w-36 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 bg-gradient-to-br from-primary-600 via-primary-500 to-accent-600 text-white py-4 md:py-8 md:min-h-[180px] px-4">
                <span class="text-3xl md:text-4xl font-bold tabular-nums">{event.date.day}</span>
                <span class="text-sm font-semibold tracking-wider uppercase">{event.date.month}</span>
                <span class="text-xs opacity-90">{event.date.year}</span>
              </div>

              <!-- Content -->
              <div class="flex-1 p-5 md:p-6 min-w-0">
                <h3 class="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
                <div class="flex flex-wrap gap-3 mb-3 text-sm text-slate-500">
                  {#if event.time}
                    <span class="flex items-center gap-1">
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {event.time}
                    </span>
                  {/if}
                  {#if event.location}
                    <span class="flex items-center gap-1">
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.location}
                    </span>
                  {/if}
                </div>
                <p class="text-slate-600 leading-relaxed">{event.description || ''}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="rounded-3xl border border-violet-100/80 bg-white/80 text-center py-16 px-6 shadow-[0_12px_26px_rgba(41,67,120,0.08)]" in:fade={{ duration: 800, easing: cubicOut }}>
        <div class="w-20 h-20 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-slate-700 mb-2">No hay eventos programados</h3>
        <p class="text-slate-500 mb-8">Consulte más tarde para conocer nuestros próximos eventos.</p>
        <a href="/contacto" class="inline-block bg-gradient-to-r from-primary-600 to-accent-600 text-white font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-all shadow-md">
          Contáctenos
        </a>
      </div>
    {/if}
  </div>
</section>
