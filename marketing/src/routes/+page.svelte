<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let data;

  const content = data.content || {};
  const hero = content.hero || {};
  const about = content.about || {};
  const services = data.services || [];
  const slides = data.images || [];

  let currentSlide = 0;

  onMount(() => {
    if (slides.length > 1) {
      const interval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
      }, 5000);
      return () => clearInterval(interval);
    }
  });

  function prevSlide() { currentSlide = (currentSlide - 1 + slides.length) % slides.length; }
  function nextSlide() { currentSlide = (currentSlide + 1) % slides.length; }

  const serviceIcons = [
    // Scale of justice
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v18m-7-7l7-8 7 8M5 14h14"/></svg>',
    // Heart
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
    // People
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
  ];
  const serviceColors = [
    { bg: 'bg-primary-100', text: 'text-primary-600' },
    { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { bg: 'bg-amber-100', text: 'text-amber-600' },
  ];
</script>

<svelte:head>
  <title>Inicio - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Brindamos apoyo legal, psicológico y social a familias vulnerables. Conozca nuestros servicios." />
</svelte:head>

<!-- Hero Section -->
<section class="relative bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 text-white overflow-hidden">
  <div class="absolute inset-0 opacity-10">
    <div class="absolute inset-0" style="background-image: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15) 0%, transparent 50%);"></div>
  </div>
  <div class="container mx-auto px-6 py-20 md:py-28 relative z-10">
    <div class="max-w-4xl mx-auto text-center">
      <h1
        class="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight"
        in:fade={{ duration: 800, easing: cubicOut }}
      >
        {hero.title || 'Fortaleciendo Familias, Construyendo Comunidad'}
      </h1>
      <p
        class="text-lg md:text-xl text-primary-100 mb-10 max-w-3xl mx-auto leading-relaxed"
        in:slide={{ duration: 800, delay: 200, easing: cubicOut }}
      >
        {hero.subtitle || 'Centro de Apoyo para la Familia A.C. brinda servicios legales, psicológicos y de asistencia social.'}
      </p>
      <div class="flex flex-col sm:flex-row justify-center gap-4" in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
        <a
          href="/contacto"
          class="bg-white text-primary-700 font-bold py-3.5 px-8 rounded-lg text-lg hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl"
        >
          {hero.cta_primary || 'Contáctenos'}
        </a>
        <a
          href="/servicios"
          class="border-2 border-white/80 text-white font-bold py-3.5 px-8 rounded-lg text-lg hover:bg-white/10 transition-all"
        >
          {hero.cta_secondary || 'Nuestros Servicios'}
        </a>
      </div>
    </div>
  </div>
  <!-- Wave divider -->
  <div class="absolute bottom-0 left-0 w-full leading-[0]">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" preserveAspectRatio="none" class="w-full h-16 md:h-24">
      <path fill="#f9fafb" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L0,120Z"></path>
    </svg>
  </div>
</section>

<!-- About / Mission Section -->
<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-6">
    <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        {about.title || 'Sobre Nosotros'}
      </h2>
      <p class="text-lg text-gray-600 leading-relaxed">
        {about.description || 'Somos una organización sin fines de lucro dedicada a fortalecer el núcleo familiar.'}
      </p>
    </div>

    {#if about.mission || about.vision}
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {#if about.mission}
          <div class="bg-white rounded-xl p-8 shadow-sm border border-gray-100 card-lift">
            <div class="w-12 h-12 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-3">Nuestra Misión</h3>
            <p class="text-gray-600 leading-relaxed">{about.mission}</p>
          </div>
        {/if}
        {#if about.vision}
          <div class="bg-white rounded-xl p-8 shadow-sm border border-gray-100 card-lift">
            <div class="w-12 h-12 bg-accent-100 text-accent-600 rounded-lg flex items-center justify-center mb-4" style="background-color: #ede9fe;">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-3">Nuestra Visión</h3>
            <p class="text-gray-600 leading-relaxed">{about.vision}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>

<!-- Services Overview -->
<section class="py-20 bg-white">
  <div class="container mx-auto px-6">
    <div class="text-center mb-14">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nuestros Servicios</h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Un enfoque integral para el bienestar de su familia.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      {#each services as service, i}
        <div class="card-lift bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" in:slide={{ duration: 600, delay: i * 150, easing: cubicOut }}>
          <div class="p-8">
            <div class="{serviceColors[i % 3].bg} {serviceColors[i % 3].text} rounded-xl h-14 w-14 flex items-center justify-center mb-5">
              {@html serviceIcons[i % 3]}
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
            <p class="text-gray-600 text-sm leading-relaxed">{service.description}</p>
          </div>
          <div class="px-8 pb-6">
            <a href="/servicios" class="text-primary-600 font-medium text-sm hover:text-primary-700 transition-colors inline-flex items-center gap-1">
              Más información
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      {/each}
      {#if services.length === 0}
        <!-- Fallback static cards -->
        {#each ['Asesoría Legal', 'Apoyo Psicológico', 'Asistencia Social'] as title, i}
          <div class="card-lift bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div class="{serviceColors[i].bg} {serviceColors[i].text} rounded-xl h-14 w-14 flex items-center justify-center mb-5">
              {@html serviceIcons[i]}
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-3">{title}</h3>
            <p class="text-gray-600 text-sm">Orientación y apoyo profesional para su familia.</p>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

<!-- Photo Carousel -->
{#if slides.length > 0}
<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-6">
    <div class="text-center mb-10">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900">Nuestra Comunidad</h2>
      <p class="text-gray-600 mt-2">Momentos de nuestros talleres, eventos y actividades.</p>
    </div>
    <div class="relative w-full max-w-4xl mx-auto h-80 md:h-96 rounded-2xl overflow-hidden shadow-xl" role="region" aria-label="Carrusel de fotos">
      {#each slides as slide, index}
        {#if index === currentSlide}
          <div class="absolute inset-0" transition:fade={{ duration: 500 }}>
            <img src={slide.src} alt={slide.alt} class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          </div>
        {/if}
      {/each}
      {#if slides.length > 1}
        <button on:click={prevSlide} class="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-2.5 rounded-full shadow-md hover:bg-white transition-colors" aria-label="Anterior">
          <svg class="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button on:click={nextSlide} class="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-2.5 rounded-full shadow-md hover:bg-white transition-colors" aria-label="Siguiente">
          <svg class="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
        <!-- Dots -->
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {#each slides as _, i}
            <button
              class="w-2.5 h-2.5 rounded-full transition-all {i === currentSlide ? 'bg-white scale-110' : 'bg-white/50'}"
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

<!-- CTA Section -->
<section class="bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 text-white">
  <div class="container mx-auto px-6 py-16 md:py-20 text-center relative">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">¿Listo para dar el primer paso?</h2>
      <p class="text-primary-100 mb-8 text-lg leading-relaxed">
        Nuestro equipo está aquí para ayudarle. Contáctenos hoy para programar una consulta confidencial.
      </p>
      <a
        href="/contacto"
        class="inline-block bg-white text-primary-700 font-bold py-3.5 px-8 rounded-lg text-lg hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl"
      >
        Habla con Nosotros
      </a>
    </div>
  </div>
</section>
