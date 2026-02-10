<script>
    import { onMount } from 'svelte';
    import { fade, slide } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
  
    let currentSlide = 0;
    // Use placeholders until real images are added to static/images/ (community1–3.jpg)
    let slides = [
      { src: 'https://picsum.photos/seed/caf1/1200/600', alt: 'Taller comunitario en acción' },
      { src: 'https://picsum.photos/seed/caf2/1200/600', alt: 'Evento familiar en el centro' },
      { src: 'https://picsum.photos/seed/caf3/1200/600', alt: 'Voluntarios ayudando en la comunidad' }
    ];
  
    // Auto-advance carousel every 5 seconds
    onMount(() => {
      const interval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
      }, 5000);
      return () => clearInterval(interval);
    });
  
    function prevSlide() {
      currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    }
  
    function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
    }
  </script>
  
  <svelte:head>
    <title>Inicio - Centro de Apoyo para la Familia A.C.</title>
    <meta name="description" content="Brindamos apoyo legal, psicológico y social a familias vulnerables en nuestra comunidad. Conozca nuestros servicios y cómo podemos ayudarle." />
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
  </svelte:head>
  
  <!-- Hero Section -->
  <section class="relative bg-gradient-to-b from-blue-700 to-blue-800 text-white text-center overflow-hidden">
    <div class="absolute inset-0 bg-repeat bg-center opacity-5" style="background-image: url('/patterns/subtle-dots.svg');"></div>
    <div class="container mx-auto px-6 py-16 md:py-20 relative z-10">
      <h1 class="text-4xl md:text-6xl font-extrabold leading-tight mb-4" in:fade={{ duration: 800, easing: cubicOut }}>
        Fortaleciendo Familias, Construyendo Comunidad
      </h1>
      <p class="text-lg md:text-xl text-blue-100 mb-10 max-w-3xl mx-auto" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
        Su centro de confianza para asesoría legal, apoyo psicológico y asistencia social en El Paso.
      </p>
      <div class="flex justify-center space-x-4" in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
        <a
          href="tel:+1-915-555-0123"
          class="bg-white text-blue-700 font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Llamar para solicitar ayuda"
        >
          📞 Llamar Ahora
        </a>
        <a
          href="/contacto"
          class="border-2 border-white text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-white hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Ver nuestros servicios"
        >
          Ver Servicios
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
  
  <!-- Services Overview Section -->
  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-6">
      <div class="text-center max-w-3xl mx-auto" in:fade={{ duration: 800, easing: cubicOut }}>
        <h2 class="text-3xl font-bold text-gray-800 mb-4">Un Espacio de Apoyo y Confianza</h2>
        <p class="text-lg text-gray-600">
          Desde 20XX, el Centro de Apoyo para la Familia (CAF) ha sido un pilar en la comunidad, ofreciendo un lugar seguro y accesible para resolver problemas complejos. Creemos en el poder de la familia y trabajamos incansablemente para proporcionar las herramientas necesarias para un futuro más brillante y estable.
        </p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mt-16">
        <!-- Service Card 1 -->
        <div class="transform hover:-translate-y-2 transition-transform duration-300" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
          <div class="bg-white p-8 rounded-lg shadow-lg h-full">
            <div class="bg-blue-100 text-blue-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Asesoría Legal</h3>
            <p class="text-gray-600">Orientación experta en temas familiares, civiles y migratorios.</p>
          </div>
        </div>
        <!-- Service Card 2 -->
        <div class="transform hover:-translate-y-2 transition-transform duration-300" in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
          <div class="bg-white p-8 rounded-lg shadow-lg h-full">
            <div class="bg-green-100 text-green-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Apoyo Psicológico</h3>
            <p class="text-gray-600">Terapia individual, de pareja y familiar para el bienestar emocional.</p>
          </div>
        </div>
        <!-- Service Card 3 -->
        <div class="transform hover:-translate-y-2 transition-transform duration-300" in:slide={{ duration: 800, delay: 600, easing: cubicOut }}>
          <div class="bg-white p-8 rounded-lg shadow-lg h-full">
            <div class="bg-orange-100 text-orange-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Asistencia Social</h3>
            <p class="text-gray-600">Conexión con recursos y programas de apoyo comunitario.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
  
  <!-- Photo Carousel Section -->
  <section class="py-20 bg-white">
    <div class="container mx-auto px-6">
      <div class="text-center mb-12" in:fade={{ duration: 800, easing: cubicOut }}>
        <h2 class="text-3xl font-bold text-gray-800">Nuestra Comunidad en Acción</h2>
        <p class="text-gray-600 mt-2">Momentos de nuestros talleres, eventos y actividades comunitarias.</p>
      </div>
      <div class="relative w-full h-96 rounded-lg overflow-hidden shadow-lg" role="region" aria-label="Carrusel de fotos comunitarias">
        {#each slides as slide, index}
          {#if index === currentSlide}
            <div class="absolute inset-0" transition:fade={{ duration: 500 }}>
              <img src={slide.src} alt={slide.alt} class="w-full h-full object-cover" />
            </div>
          {/if}
        {/each}
        <button
          on:click={prevSlide}
          class="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Foto anterior"
        >
          <svg class="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <button
          on:click={nextSlide}
          class="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Foto siguiente"
        >
          <svg class="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  </section>
  
  <!-- Call to Action Section -->
  <section class="bg-gradient-to-b from-blue-700 to-blue-800 text-white">
    <div class="container mx-auto px-6 py-16 text-center relative">
      <div class="absolute inset-0 bg-repeat bg-center opacity-5" style="background-image: url('/patterns/subtle-dots.svg');"></div>
      <div class="relative z-10" in:fade={{ duration: 800, easing: cubicOut }}>
        <h2 class="text-3xl md:text-4xl font-bold mb-4">¿Listo para dar el primer paso?</h2>
        <p class="text-blue-200 mb-8 max-w-2xl mx-auto text-lg">Nuestro equipo está aquí para ayudarle. Contáctenos hoy para programar una consulta confidencial o para obtener más información sobre nuestros servicios.</p>
        <a
          href="/contacto"
          class="bg-white text-blue-700 font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Contactar con nuestro equipo"
        >
          Habla con Nosotros
        </a>
      </div>
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
  </style>
