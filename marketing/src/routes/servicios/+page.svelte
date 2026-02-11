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

<!-- Page Header -->
<section class="relative bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 text-white overflow-hidden py-16 md:py-20">
  <div class="container mx-auto px-6 relative z-10 text-center">
    <h1 class="text-4xl md:text-5xl font-extrabold leading-tight mb-4" in:fade={{ duration: 800, easing: cubicOut }}>
      Nuestros Servicios
    </h1>
    <p class="text-lg md:text-xl text-primary-100 max-w-3xl mx-auto" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
      Un enfoque integral para el bienestar de su familia.
    </p>
  </div>
  <div class="absolute bottom-0 left-0 w-full leading-[0]">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" preserveAspectRatio="none" class="w-full h-16 md:h-24">
      <path fill="#f9fafb" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L0,120Z"></path>
    </svg>
  </div>
</section>

<!-- Services -->
<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-6">
    <div class="space-y-20 max-w-5xl mx-auto">
      {#each data.services as service, i}
        <div
          class="grid md:grid-cols-2 gap-10 items-center"
          in:slide={{ duration: 600, delay: i * 150, easing: cubicOut }}
        >
          <!-- Image -->
          <div class:md:order-2={i % 2 !== 0}>
            {#if service.imageUrl}
              <img
                src={service.imageUrl}
                alt={service.title}
                class="rounded-2xl shadow-lg w-full h-64 md:h-80 object-cover"
                loading="lazy"
              />
            {:else}
              <div class="rounded-2xl bg-gradient-to-br {serviceColors[i % 3]} w-full h-64 md:h-80 flex items-center justify-center shadow-lg">
                <span class="text-white text-5xl font-bold opacity-80">{service.title.charAt(0)}</span>
              </div>
            {/if}
          </div>

          <!-- Content -->
          <div class:md:order-1={i % 2 !== 0}>
            <h2 class="text-3xl font-bold text-gray-900 mb-4">{service.title}</h2>
            <p class="text-gray-600 mb-6 leading-relaxed">{service.description}</p>
            {#if service.details && service.details.length > 0}
              <ul class="space-y-2">
                {#each service.details as detail}
                  <li class="flex items-start gap-3 text-gray-700">
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

<!-- CTA -->
<section class="bg-gradient-to-br from-primary-700 to-accent-700 text-white py-16">
  <div class="container mx-auto px-6 text-center">
    <h2 class="text-3xl font-bold mb-4">¿Necesita nuestros servicios?</h2>
    <p class="text-primary-100 mb-8 max-w-xl mx-auto">Contáctenos para programar una consulta confidencial sin costo.</p>
    <a href="/contacto" class="inline-block bg-white text-primary-700 font-bold py-3.5 px-8 rounded-lg text-lg hover:bg-primary-50 transition-all shadow-lg">
      Contáctenos
    </a>
  </div>
</section>
