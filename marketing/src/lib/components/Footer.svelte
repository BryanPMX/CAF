<script>
  import { config } from '$lib/config.js';
</script>

<footer class="bg-gray-900 text-gray-300">
  <!-- Top accent bar -->
  <div class="h-1 bg-gradient-to-r from-primary-600 to-accent-600"></div>

  <div class="container mx-auto px-6 py-12">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-x-12">
      <!-- Brand -->
      <div>
        <div class="flex items-center gap-3 mb-4">
          <img src="/logo.png" alt="Logo CAF" class="h-12 w-auto opacity-95" />
          <span class="font-bold text-lg text-white">{config.site.name}</span>
        </div>
        <p class="text-gray-400 leading-relaxed text-sm max-w-md">
          {config.site.description}
        </p>
      </div>

      <!-- Navegación: centered in middle column, label centered above button row -->
      <div class="flex flex-col items-center justify-start md:px-6 text-center">
        <h4 class="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Navegación</h4>
        <ul class="flex flex-col md:flex-row md:flex-nowrap gap-y-2.5 md:gap-y-0 md:gap-x-6 md:items-center md:justify-center">
          <li class="flex-shrink-0"><a href="/" class="text-sm text-gray-400 hover:text-white transition-colors py-2 md:py-0">Inicio</a></li>
          <li class="flex-shrink-0"><a href="/servicios" class="text-sm text-gray-400 hover:text-white transition-colors py-2 md:py-0">Servicios</a></li>
          <li class="flex-shrink-0"><a href="/eventos" class="text-sm text-gray-400 hover:text-white transition-colors py-2 md:py-0">Eventos</a></li>
          <li class="flex-shrink-0"><a href="/contacto" class="text-sm text-gray-400 hover:text-white transition-colors py-2 md:py-0">Contacto</a></li>
        </ul>
      </div>

      <!-- Contact (address and email only; phone removed) -->
      <div>
        <h4 class="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contacto</h4>
        <ul class="space-y-2.5 text-sm text-gray-400">
          <li class="flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{config.contact.address}</span>
          </li>
          <li>
            <a href="mailto:{config.contact.email}" class="flex items-start gap-2 hover:text-white transition-colors">
              <svg class="w-4 h-4 mt-0.5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{config.contact.email}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="mt-10 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
      <p>&copy; {new Date().getFullYear()} {config.site.name}. Todos los derechos reservados.</p>
    </div>
  </div>
</footer>
