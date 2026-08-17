<script>
  import { ArrowRight, CalendarDays, Clock3, MapPin } from '@lucide/svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import PageHero from '$lib/components/PageHero.svelte';
  import { buildResponsiveSrcSet, getOptimizedImageUrl } from '$lib/utils/imageOptimizer.js';
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

<PageHero eyebrow="Comunidad CAF" title="Espacios para aprender, crecer y conectar" description="Conoce nuestros próximos talleres, pláticas y actividades para familias y comunidad." />

<section class="section-shell section-soft">
  <div class="site-container max-w-5xl">
    <h2 class="sr-only">Listado de eventos comunitarios</h2>
    {#if data.events.length > 0}
      <div class="space-y-6">
        {#each data.events as event, i}
          <div
            class="card-lift overflow-hidden rounded-2xl"
            in:slide={{ duration: 600, delay: i * 100, easing: cubicOut }}
          >
            <div class="flex flex-col md:flex-row min-h-[180px]">
              <!-- Event image (from URL) -->
              {#if event.imageUrl && event.imageUrl.trim()}
                <div class="md:w-48 lg:w-56 flex-shrink-0 bg-gray-100 min-h-[160px] md:min-h-[180px]">
                  <img
                    src={getOptimizedImageUrl(event.imageUrl, 640)}
                    alt={event.title || 'Evento'}
                    width="640"
                    height="480"
                    srcset={buildResponsiveSrcSet(event.imageUrl, [320, 480, 640, 768]) || undefined}
                    sizes="(max-width: 768px) 100vw, 224px"
                    class="w-full h-full min-h-[160px] md:min-h-[180px] object-cover"
                    onerror={onImageError}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              {/if}
              <!-- Date strip -->
              <div class="flex w-full flex-shrink-0 flex-row items-center justify-center gap-2 bg-primary-950 px-4 py-4 text-white md:min-h-[180px] md:w-36 md:flex-col md:gap-0 md:py-8">
                <span class="text-3xl md:text-4xl font-bold tabular-nums">{event.date.day}</span>
                <span class="text-sm font-semibold tracking-wider uppercase">{event.date.month}</span>
                <span class="text-xs opacity-90">{event.date.year}</span>
              </div>

              <!-- Content -->
              <div class="flex-1 p-5 md:p-6 min-w-0">
                <h3 class="mb-3 text-xl font-extrabold tracking-[-0.02em] text-primary-950">{event.title}</h3>
                <div class="flex flex-wrap gap-3 mb-3 text-sm text-slate-500">
                  {#if event.time}
                    <span class="flex items-center gap-1">
                      <Clock3 class="shrink-0 text-accent-600" size={16} />
                      {event.time}
                    </span>
                  {/if}
                  {#if event.location}
                    <span class="flex items-center gap-1">
                      <MapPin class="shrink-0 text-accent-600" size={16} />
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
      <div class="surface-card rounded-2xl px-6 py-12 text-center" in:fade={{ duration: 800, easing: cubicOut }}>
        <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <CalendarDays size={38} strokeWidth={1.6} />
        </div>
        <h3 class="text-xl font-semibold text-slate-700 mb-2">No hay eventos programados</h3>
        <p class="text-slate-500 mb-8">Consulte más tarde para conocer nuestros próximos eventos.</p>
        <a href="/contacto" class="button-primary inline-flex">
          Mantenerme en contacto <ArrowRight size={18} />
        </a>
      </div>
    {/if}
  </div>
</section>
