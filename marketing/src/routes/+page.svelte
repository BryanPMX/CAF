<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let data;

  const content = data.content || {};
  const hero = content.hero || {};
  const about = content.about || {};
  const services = data.services || [];
  const heroSlides = data.images || [];
  const gallerySlides = data.galleryImages || [];
  const slides = gallerySlides.length > 0 ? gallerySlides : heroSlides;
  const gallerySectionImages = data.gallerySectionImages || [];
  const aboutSectionImages = data.aboutSectionImages || [];

  let currentSlide = 0;

  onMount(() => {
    if (slides.length > 1) {
      const interval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
      }, 5000);
      return () => clearInterval(interval);
    }
  });

  function prevSlide() {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
  }

  const serviceIcons = [
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v18m-7-7l7-8 7 8M5 14h14"/></svg>',
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
  ];

  const serviceColors = [
    { bg: 'bg-primary-100', text: 'text-primary-700' },
    { bg: 'bg-sky-100', text: 'text-sky-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ];
</script>

<svelte:head>
  <title>Inicio - Centro de Apoyo para la Familia A.C.</title>
  <meta
    name="description"
    content="Brindamos apoyo legal, psicológico y social a familias vulnerables. Conozca nuestros servicios."
  />
</svelte:head>

<section class="hero-wave-scene relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-[#8d6bf7] text-white">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.24),transparent_45%),radial-gradient(circle_at_82%_18%,rgba(232,206,255,0.28),transparent_38%)]"></div>
  <div class="spotlight -left-28 top-14 h-52 w-72 bg-primary-300"></div>
  <div class="spotlight -right-20 top-12 h-52 w-72 bg-[#d4b7ff]"></div>

  <div class="container relative z-10 mx-auto px-4 py-16 sm:px-6 sm:py-20 md:py-28">
    <div class="mx-auto max-w-4xl text-center">
      <span class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
        Acompañamiento Integral
      </span>

      <h1
        class="mb-5 text-3xl font-extrabold leading-tight tracking-tight drop-shadow-[0_6px_22px_rgba(2,15,33,0.45)] sm:text-4xl md:text-6xl"
        in:fade={{ duration: 800, easing: cubicOut }}
      >
        {hero.title || 'Fortaleciendo Familias, Construyendo Comunidad'}
      </h1>

      <p
        class="mx-auto mb-9 max-w-3xl text-base leading-relaxed text-primary-100 sm:text-lg md:text-xl"
        in:slide={{ duration: 800, delay: 200, easing: cubicOut }}
      >
        {hero.subtitle || 'Centro de Apoyo para la Familia A.C. brinda servicios legales, psicológicos y de asistencia social.'}
      </p>

      <div class="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4" in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
        <a
          href="/servicios"
          data-sveltekit-reload
          class="btn-elevated fade-interact rounded-xl bg-white px-8 py-3.5 text-base font-bold text-primary-800 shadow-[0_16px_34px_rgba(4,19,41,0.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary-50 sm:text-lg"
        >
          Nuestros Servicios
        </a>
      </div>
    </div>
  </div>

  <div class="hero-wave-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" preserveAspectRatio="none" class="hero-wave-svg hero-wave-back h-20 w-full md:h-28">
      <path class="hero-wave-path-back" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L0,120Z"></path>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" preserveAspectRatio="none" class="hero-wave-svg hero-wave-front h-16 w-full md:h-24">
      <path class="hero-wave-path-front" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L0,120Z"></path>
    </svg>
  </div>
</section>

<section class="py-12 sm:py-20 bg-[radial-gradient(circle_at_14%_20%,rgba(141,107,247,0.18),transparent_34%),radial-gradient(circle_at_84%_20%,rgba(56,120,214,0.15),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8f2ff_50%,#eef6ff_100%)]">
  <div class="container mx-auto px-4 sm:px-6">
    <div class="mx-auto mb-10 max-w-3xl text-center sm:mb-14" in:fade={{ duration: 700, easing: cubicOut }}>
      <p class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">Compromiso CAF</p>
      <h2 class="mb-5 text-3xl font-bold md:text-4xl">{about.title || 'Sobre Nosotros'}</h2>
      <p class="text-lg leading-relaxed text-slate-600">
        {about.description || 'Somos una organización sin fines de lucro dedicada a fortalecer el núcleo familiar.'}
      </p>
    </div>

    {#if aboutSectionImages.length > 0}
      <div class="mx-auto mb-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each aboutSectionImages as img}
          <div class="card-lift group overflow-hidden rounded-2xl">
            <img
              src={img.src}
              alt={img.alt}
              class="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        {/each}
      </div>
    {/if}

    {#if about.mission || about.vision}
      <div class="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
        {#if about.mission}
          <div class="card-lift rounded-2xl p-8">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-[0_10px_20px_rgba(19,80,145,0.24)]">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="mb-3 text-xl font-bold text-slate-900">Nuestra Misión</h3>
            <p class="leading-relaxed text-slate-600">{about.mission}</p>
          </div>
        {/if}

        {#if about.vision}
          <div class="card-lift rounded-2xl p-8">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-600 to-accent-700 text-white shadow-[0_10px_20px_rgba(12,124,113,0.25)]">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 class="mb-3 text-xl font-bold text-slate-900">Nuestra Visión</h3>
            <p class="leading-relaxed text-slate-600">{about.vision}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>

<section class="bg-[radial-gradient(circle_at_14%_16%,rgba(141,107,247,0.16),transparent_35%),radial-gradient(circle_at_84%_16%,rgba(56,120,214,0.14),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f7f1ff_48%,#eef6ff_100%)] py-12 sm:py-20">
  <div class="container mx-auto px-4 sm:px-6">
    <div class="mx-auto mb-10 max-w-3xl text-center sm:mb-14" in:fade={{ duration: 700, easing: cubicOut }}>
      <p class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">Atención Especializada</p>
      <h2 class="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">Nuestros Servicios</h2>
      <p class="mx-auto max-w-2xl text-lg text-slate-600">Un enfoque integral para el bienestar de su familia.</p>
    </div>

    <div class="grid grid-cols-1 gap-7 md:grid-cols-3">
      {#each services as service, i}
        <div class="card-lift overflow-hidden rounded-2xl" in:slide={{ duration: 600, delay: i * 150, easing: cubicOut }}>
          <div class="h-1.5 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500"></div>
          <div class="p-8">
            <div class="{serviceColors[i % 3].bg} {serviceColors[i % 3].text} mb-5 flex h-14 w-14 items-center justify-center rounded-xl">
              {@html serviceIcons[i % 3]}
            </div>
            <h3 class="mb-3 text-xl font-bold text-slate-900">{service.title}</h3>
            <p class="text-sm leading-relaxed text-slate-600">{service.description}</p>
          </div>
          <div class="px-8 pb-7">
            <a
              href="/servicios"
              data-sveltekit-reload
              class="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              Más información
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      {/each}

      {#if services.length === 0}
        {#each ['Asesoría Legal', 'Apoyo Psicológico', 'Asistencia Social'] as title, i}
          <div class="card-lift rounded-2xl p-8">
            <div class="{serviceColors[i].bg} {serviceColors[i].text} mb-5 flex h-14 w-14 items-center justify-center rounded-xl">
              {@html serviceIcons[i]}
            </div>
            <h3 class="mb-3 text-xl font-bold text-slate-900">{title}</h3>
            <p class="text-sm text-slate-600">Orientación y apoyo profesional para su familia.</p>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

{#if slides.length > 0}
  <section class="py-16 sm:py-20">
    <div class="container mx-auto px-6">
      <div class="mb-10 text-center">
        <p class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">Vida Comunitaria</p>
        <h2 class="text-3xl font-bold text-slate-900 md:text-4xl">Nuestra Comunidad</h2>
        <p class="mt-2 text-slate-600">Momentos de nuestros talleres, eventos y actividades.</p>
      </div>

      <div class="relative mx-auto h-[28rem] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/55 bg-white/15 shadow-[0_30px_60px_rgba(13,33,56,0.22)] backdrop-blur-xl sm:h-[32rem] md:h-[36rem]" role="region" aria-label="Carrusel de fotos">
        {#each slides as slide, index}
          {#if index === currentSlide}
            <div class="absolute inset-0" transition:fade={{ duration: 500 }}>
              <img src={slide.src} alt={slide.alt} class="h-full w-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent"></div>
            </div>
          {/if}
        {/each}

        {#if slides.length > 1}
          <button on:click={prevSlide} class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/80 p-2.5 text-slate-800 shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-white" aria-label="Anterior">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button on:click={nextSlide} class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/80 p-2.5 text-slate-800 shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-white" aria-label="Siguiente">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {#each slides as _, i}
              <button
                class="h-2.5 w-2.5 rounded-full transition-all {i === currentSlide ? 'bg-white scale-110' : 'bg-white/50'}"
                on:click={() => currentSlide = i}
                aria-label="Ir a imagen {i + 1}"
              ></button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </section>
{/if}

{#if gallerySectionImages.length > 0}
  <section class="bg-[radial-gradient(circle_at_18%_16%,rgba(141,107,247,0.16),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(56,120,214,0.14),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8f2ff_52%,#edf6ff_100%)] py-16 sm:py-20">
    <div class="container mx-auto px-4 sm:px-6">
      <div class="mb-10 text-center">
        <h2 class="text-3xl font-bold text-slate-900 md:text-4xl">Galería</h2>
        <p class="mx-auto mt-2 max-w-2xl text-slate-600">Algunos momentos de nuestro trabajo y comunidad.</p>
      </div>
      <div class="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {#each gallerySectionImages as img}
          <div class="group overflow-hidden rounded-2xl border border-white/75 bg-white/75 shadow-[0_14px_28px_rgba(16,39,67,0.12)] aspect-square">
            <img
              src={img.src}
              alt={img.alt}
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          </div>
        {/each}
      </div>
    </div>
  </section>
{/if}

<section class="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-[#8d6bf7] text-white">
  <div class="spotlight -left-24 top-10 h-40 w-72 bg-primary-300"></div>
  <div class="spotlight -right-20 bottom-8 h-40 w-72 bg-accent-400"></div>

  <div class="container relative mx-auto px-6 py-16 text-center md:py-20">
    <div class="glass-panel mx-auto max-w-3xl rounded-3xl border-white/35 bg-white/18 p-8 text-white sm:p-10">
      <h2 class="mb-4 text-3xl font-bold md:text-4xl">
        <span class="inline-block rounded-2xl border border-white/35 bg-[linear-gradient(130deg,rgba(27,68,136,0.9),rgba(123,96,217,0.88))] px-5 py-2.5 text-white shadow-[0_12px_28px_rgba(6,19,40,0.34)]">
          ¿Listo para dar el primer paso?
        </span>
      </h2>
      <p class="mb-8 text-lg leading-relaxed text-primary-100">
        Nuestro equipo está aquí para ayudarle. Contáctenos hoy para programar una consulta confidencial.
      </p>
      <a
        href="/contacto"
        class="btn-elevated fade-interact inline-block rounded-xl bg-white px-8 py-3.5 text-lg font-bold text-primary-800 shadow-[0_18px_34px_rgba(3,20,41,0.34)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary-50"
      >
        Habla con Nosotros
      </a>
    </div>
  </div>
</section>
