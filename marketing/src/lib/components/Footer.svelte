<script>
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
</script>

<footer class="relative bg-gradient-to-b from-gray-200 to-gray-300 text-black overflow-hidden" in:fade={{ duration: 800, easing: cubicOut }}>
  <div class="absolute inset-0 bg-repeat bg-center opacity-5" style="background-image: url('/patterns/subtle-dots.svg');"></div>
  <div class="absolute top-0 left-0 w-full leading-[0] animate-wave">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path
        fill="#f9fafb"
        fill-opacity="0.3"
        d="M0,160L48,149.3C96,139,192,117,288,112C384,107,480,117,576,149.3C672,181,768,235,864,250.7C960,267,1056,245,1152,218.7C1248,192,1344,160,1392,144L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
      ></path>
      <path
        fill="#f9fafb"
        fill-opacity="1"
        d="M0,224L48,208C96,192,192,160,288,160C384,160,480,192,576,218.7C672,245,768,267,864,250.7C960,235,1056,181,1152,170.7C1248,160,1344,192,1392,208L1440,224L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
      ></path>
    </svg>
  </div>
  <div class="container mx-auto px-4 sm:px-6 py-10 relative z-10">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <!-- About Section with Logo -->
      <div class="col-span-1 md:col-span-2" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
        <div class="flex items-center space-x-3 mb-4">
          <img
            src="/logo.png"
            alt="Logo del Centro de Apoyo para la Familia"
            class="h-16 w-auto transition-transform duration-300 hover:scale-110"
            aria-label="Logo del Centro de Apoyo para la Familia"
          />
          <h3 class="font-bold text-xl text-black">Centro de Apoyo para la Familia A.C.</h3>
        </div>
        <p class="text-black leading-relaxed">
          Desde 20XX, empoderando a las familias de nuestra comunidad con apoyo integral, profesional y confidencial.
        </p>
      </div>
      <!-- Quick Links -->
      <div in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
        <h3 class="font-bold text-lg mb-2 text-black">Navegación</h3>
        <ul class="space-y-2">
          <li>
            <a
              href="/"
              class="text-black hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Ir a la página de inicio"
            >
              Inicio
            </a>
          </li>
          <li>
            <a
              href="/servicios"
              class="text-black hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Ir a la página de servicios"
            >
              Servicios
            </a>
          </li>
          <li>
            <a
              href="/eventos"
              class="text-black hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Ir a la página de eventos"
            >
              Eventos
            </a>
          </li>
          <li>
            <a
              href="/contacto"
              class="text-black hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Ir a la página de contacto"
            >
              Contacto
            </a>
          </li>
        </ul>
      </div>
      <!-- Contact Info -->
      <div in:slide={{ duration: 800, delay: 600, easing: cubicOut }}>
        <h3 class="font-bold text-lg mb-2 text-black">Contáctanos</h3>
        <ul class="space-y-2 text-black">
          <li>123 Calle Ficticia, El Paso, TX</li>
          <li>
            <a
              href="mailto:contacto@caf.org"
              class="hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Enviar correo a contacto@caf.org"
            >
              Email: contacto@caf.org
            </a>
          </li>
          <li>
            <a
              href="tel:+19151234567"
              class="hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="Llamar al (915) 123-4567"
            >
              Tel: (915) 123-4567
            </a>
          </li>
        </ul>
      </div>
    </div>
    <div class="mt-10 border-t border-gray-400 pt-6 text-center text-black text-sm" in:fade={{ duration: 800, delay: 800, easing: cubicOut }}>
      © {new Date().getFullYear()} Centro de Apoyo para la Familia A.C. | 
      <a
        href="/privacidad"
        class="hover:text-gray-800 transition-transform duration-200 hover:scale-105 inline-block"
        aria-label="Ver el aviso de privacidad"
      >
        Aviso de Privacidad
      </a>
    </div>
  </div>
</footer>

<style>
  @keyframes wave {
    0% { transform: translateY(0); }
    50% { transform: translateY(10px); }
    100% { transform: translateY(0); }
  }
  .animate-wave {
    animation: wave 4s ease-in-out infinite;
  }
</style>