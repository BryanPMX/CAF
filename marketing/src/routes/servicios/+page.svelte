<script>
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  export let data;

  const serviceColors = ['from-primary-600 to-primary-700', 'from-emerald-600 to-emerald-700', 'from-amber-500 to-amber-600'];
</script>

<svelte:head>
  <title>Nuestros Servicios - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Descubra nuestros servicios de asesoría legal, apoyo psicológico y asistencia social." />
</svelte:head>

<section class="hero-wave-scene relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-[#8d6bf7] py-16 text-white md:py-24">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.22),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(221,191,255,0.32),transparent_38%)]"></div>
  <div class="container relative z-10 mx-auto px-6 text-center">
    <h1 class="mb-4 text-4xl font-extrabold leading-tight md:text-5xl" in:fade={{ duration: 800, easing: cubicOut }}>
      Nuestros Servicios
    </h1>
    <p class="mx-auto max-w-3xl text-lg text-primary-100 md:text-xl" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
      Un enfoque integral para el bienestar de su familia.
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

<section class="py-20 bg-[radial-gradient(circle_at_14%_18%,rgba(141,107,247,0.18),transparent_34%),radial-gradient(circle_at_84%_14%,rgba(56,120,214,0.16),transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8f1ff_52%,#edf6ff_100%)]">
  <div class="container mx-auto px-6">
    <div class="space-y-20 max-w-5xl mx-auto">
      {#each data.services as service, i}
        <div
          class="grid items-center gap-10 rounded-3xl border border-violet-100/80 bg-white/80 p-6 shadow-[0_12px_28px_rgba(41,67,120,0.09)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(73,96,150,0.14)] md:grid-cols-2 md:p-8"
          in:slide={{ duration: 600, delay: i * 150, easing: cubicOut }}
        >
          <div class:md:order-2={i % 2 !== 0}>
            {#if service.imageUrl}
              <img
                src={service.imageUrl}
                alt={service.title}
                class="h-64 w-full rounded-2xl object-cover shadow-lg md:h-80"
                loading="lazy"
              />
            {:else}
              <div class="flex h-64 w-full items-center justify-center rounded-2xl bg-gradient-to-br {serviceColors[i % 3]} shadow-lg md:h-80">
                <span class="text-white text-5xl font-bold opacity-80">{service.title.charAt(0)}</span>
              </div>
            {/if}
          </div>

          <div class:md:order-1={i % 2 !== 0}>
            <h2 class="mb-4 text-3xl font-bold text-slate-900">{service.title}</h2>
            <p class="mb-6 leading-relaxed text-slate-600">{service.description}</p>
            {#if service.details && service.details.length > 0}
              <ul class="space-y-2">
                {#each service.details as detail}
                  <li class="flex items-start gap-3 text-slate-700">
                    <svg class="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
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

<section class="bg-gradient-to-br from-primary-800 to-[#8d6bf7] text-white py-16">
  <div class="container mx-auto px-6 text-center">
    <h2 class="mb-4 text-3xl font-bold">¿Necesita nuestros servicios?</h2>
    <p class="mx-auto mb-8 max-w-xl text-primary-100">Contáctenos para programar una consulta confidencial sin costo.</p>
    <a href="/contacto" class="inline-block rounded-xl bg-white px-8 py-3.5 text-lg font-bold text-primary-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary-50">
      Contáctenos
    </a>
  </div>
</section>
