<script>
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  export let data;
</script>

<svelte:head>
  <title>Nuestros Servicios - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Descubra cómo nuestros servicios de asesoría legal, apoyo psicológico y asistencia social pueden ayudarle a usted y a su familia." />
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
</svelte:head>

<!-- Page Header -->
<section class="relative bg-gradient-to-b from-blue-700 to-blue-800 text-white text-center overflow-hidden py-16 md:py-20">
  <div class="absolute inset-0 bg-repeat bg-center opacity-5" style="background-image: url('/patterns/subtle-dots.svg');"></div>
  <div class="container mx-auto px-6 relative z-10">
    <h1
      class="text-4xl md:text-5xl font-extrabold leading-tight mb-4 transform hover:scale-105 transition-transform duration-300"
      in:fade={{ duration: 800, easing: cubicOut }}
      aria-label="Nuestros Servicios"
    >
      Nuestros Servicios
    </h1>
    <p
      class="text-lg md:text-xl text-blue-100 mb-8 max-w-3xl mx-auto"
      in:slide={{ duration: 800, delay: 200, easing: cubicOut }}
    >
      Un enfoque integral para el bienestar de su familia.
    </p>
    <div in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
      <a
        href="/contacto"
        class="bg-white text-blue-700 font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Contáctenos para más información"
      >
        Contáctenos
      </a>
    </div>
  </div>
  <div class="absolute bottom-0 left-0 w-full leading-[0] animate-wave">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path
        fill="#ffffff"
        fill-opacity="0.3"
        d="M0,160L48,170.7C96,181,192,203,288,208C384,213,480,203,576,170.7C672,139,768,85,864,80C960,75,1056,117,1152,133.3C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
      ></path>
      <path
        fill="#f9fafb"
        fill-opacity="1"
        d="M0,224L48,208C96,192,192,160,288,160C384,160,480,192,576,218.7C672,245,768,267,864,250.7C960,235,1056,181,1152,170.7C1248,160,1344,192,1392,208L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
      ></path>
    </svg>
  </div>
</section>

<!-- Main Content Area with Dynamic Cards -->
<section class="container mx-auto px-6 py-20">
  <div class="space-y-16">
    {#each data.services as service, i}
      <div
        class="grid md:grid-cols-2 gap-8 md:gap-12 items-center transform hover:-translate-y-1 transition-transform duration-300"
        in:slide={{ duration: 800, delay: i * 200, easing: cubicOut }}
        role="article"
        aria-labelledby={`service-title-${i}`}
      >
        <!-- Image Section -->
        <div class:md:order-2={i % 2 !== 0} class="relative">
          <img
            src={service.imageUrl || '/images/placeholder-service.jpg'}
            alt={service.title}
            class="rounded-lg shadow-2xl w-full h-64 md:h-80 object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
          {#if !service.imageUrl}
            <div class="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
              <span class="text-gray-500 italic">Imagen no disponible</span>
            </div>
          {/if}
        </div>
        <!-- Text Content -->
        <div class:md:order-1={i % 2 !== 0} class="flex flex-col justify-center">
          <h2 id={`service-title-${i}`} class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            {service.title}
          </h2>
          <p class="text-gray-600 mb-6 leading-relaxed text-lg">
            {service.description}
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-2">
            {#each service.details as detail}
              <li class="text-base">{detail}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  @keyframes wave {
    0% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0); }
  }
  .animate-wave {
    animation: wave 4s ease-in-out infinite;
  }
  img:hover {
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
  }
</style>