<script>
  import { ArrowRight, CheckCircle2 } from '@lucide/svelte';
  import PageHero from '$lib/components/PageHero.svelte';
  import { buildResponsiveSrcSet, getOptimizedImageUrl } from '$lib/utils/imageOptimizer.js';
  export let data;

  const serviceColors = ['from-primary-600 to-primary-800', 'from-accent-500 to-accent-700', 'from-warm-500 to-warm-600'];
</script>

<svelte:head>
  <title>Nuestros Servicios - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Descubra nuestros servicios de asesoría legal, apoyo psicológico y asistencia social." />
</svelte:head>

<PageHero eyebrow="Acompañamiento integral" title="Servicios para cada etapa de tu proceso" description="Orientación legal, apoyo psicológico y asistencia social reunidos en un mismo espacio de confianza." />

<section class="section-shell section-soft">
  <div class="site-container">
    <div class="mx-auto max-w-3xl text-center" data-aos="fade-up">
      <p class="eyebrow mb-4">Cómo podemos ayudarte</p>
      <h2 class="section-title text-primary-950">Atención coordinada, clara y centrada en tu familia</h2>
      <p class="section-copy mt-4">Cada situación es distinta. Nuestro equipo escucha tus necesidades y te ayuda a identificar el servicio más adecuado.</p>
    </div>
    <div class="mx-auto mt-9 max-w-6xl space-y-5">
      {#each data.services as service, i}
        <div
          class="card-lift grid items-center gap-7 overflow-hidden rounded-2xl p-5 md:grid-cols-2 md:p-6 lg:gap-10"
          data-aos={i % 2 === 0 ? 'fade-right' : 'fade-left'}
          data-aos-delay={String(Math.min(i * 70, 210))}
        >
          <div class="media-zoom overflow-hidden rounded-2xl" class:md:order-2={i % 2 !== 0}>
            {#if service.imageUrl}
              <img
                src={getOptimizedImageUrl(service.imageUrl, 960)}
                alt={service.title}
                width="1200"
                height="900"
                srcset={buildResponsiveSrcSet(service.imageUrl, [480, 640, 768, 960, 1200]) || undefined}
                sizes="(max-width: 768px) 100vw, 50vw"
                class="h-64 w-full object-cover md:h-80"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div class="flex h-64 w-full items-center justify-center rounded-2xl bg-gradient-to-br {serviceColors[i % 3]} md:h-80">
                <span class="text-white text-5xl font-bold opacity-80">{service.title.charAt(0)}</span>
              </div>
            {/if}
          </div>

          <div class:md:order-1={i % 2 !== 0}>
            <h3 class="mb-3 text-2xl font-extrabold tracking-[-0.03em] text-primary-950">{service.title}</h3>
            <p class="mb-6 leading-7 text-slate-600">{service.description}</p>
            {#if service.details && service.details.length > 0}
              <ul class="space-y-2">
                {#each service.details as detail}
                  <li class="flex items-start gap-3 text-slate-700">
                    <CheckCircle2 class="mt-0.5 shrink-0 text-accent-600" size={19} />
                    <span>{detail}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="cta-live bg-primary-950 py-16 text-white">
  <div class="site-container relative z-10 text-center" data-aos="zoom-in-up">
    <h2 class="text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl">¿No sabes por dónde comenzar?</h2>
    <p class="mx-auto mt-4 max-w-xl leading-7 text-blue-100/85">Cuéntanos tu situación. Te ayudaremos a identificar el apoyo más adecuado.</p>
    <a href="/contacto" class="button-light mt-8 inline-flex">
      Solicitar orientación <ArrowRight size={18} />
    </a>
  </div>
</section>
