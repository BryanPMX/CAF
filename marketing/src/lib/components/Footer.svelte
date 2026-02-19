<script>
  import { config } from '$lib/config.js';
</script>

<footer class="relative overflow-hidden bg-slate-950 text-slate-200">
  <div class="pointer-events-none absolute inset-0">
    <div class="spotlight -left-20 top-8 h-52 w-72 bg-primary-500/65"></div>
    <div class="spotlight right-0 top-0 h-56 w-72 bg-accent-500/58"></div>
    <div class="spotlight left-1/2 top-14 h-40 w-80 -translate-x-1/2 bg-[rgba(166,133,255,0.45)]"></div>
  </div>

  <div class="relative h-[3px] bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500"></div>

  <div class="container relative mx-auto px-6 py-10 sm:py-12">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.6fr_1fr] md:gap-6 lg:gap-8">
      <div class="footer-glass-card rounded-2xl p-6 text-slate-100">
        <div class="mb-5 flex items-center justify-center">
          <span class="brand-logo-shell">
            <span class="block rounded-[0.95rem] bg-white p-1.5">
              <img src="/logo-footer.png" alt="Logo CAF" width="313" height="393" class="h-12 w-12 object-contain sm:h-14 sm:w-14" />
            </span>
          </span>
        </div>
        <p class="mx-auto max-w-md text-center text-sm leading-relaxed text-slate-100/90">
          {config.site.description}
        </p>
      </div>

      <div class="footer-glass-card rounded-2xl p-6">
        <h2 class="mb-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">Navegación</h2>
        <ul class="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <li>
            <a href="/" class="touch-target footer-nav-pill group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-3.5 py-2 text-[0.82rem] font-medium text-slate-100/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white sm:text-sm">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-300 transition-colors duration-200 group-hover:bg-accent-300"></span>
              <span>Inicio</span>
            </a>
          </li>
          <li>
            <a href="/servicios" class="touch-target footer-nav-pill group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-3.5 py-2 text-[0.82rem] font-medium text-slate-100/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white sm:text-sm">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-300 transition-colors duration-200 group-hover:bg-accent-300"></span>
              <span>Servicios</span>
            </a>
          </li>
          <li>
            <a href="/eventos" class="touch-target footer-nav-pill group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-3.5 py-2 text-[0.82rem] font-medium text-slate-100/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white sm:text-sm">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-300 transition-colors duration-200 group-hover:bg-accent-300"></span>
              <span>Eventos</span>
            </a>
          </li>
          <li>
            <a href="/contacto" class="touch-target footer-nav-pill group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-3.5 py-2 text-[0.82rem] font-medium text-slate-100/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white sm:text-sm">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-300 transition-colors duration-200 group-hover:bg-accent-300"></span>
              <span>Contacto</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="footer-glass-card rounded-2xl p-6 text-center">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">Contacto</h2>
        <ul class="space-y-3 text-sm text-slate-100/90">
          <li class="flex items-start justify-center gap-2.5 text-left">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{config.contact.address}</span>
          </li>
          <li>
            <a href="mailto:{config.contact.email}" class="touch-target inline-flex items-center justify-center gap-2.5 rounded-lg px-2 text-sm text-slate-100/90 transition-colors duration-200 hover:text-white">
              <svg class="h-4 w-4 flex-shrink-0 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{config.contact.email}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-8 rounded-xl bg-slate-900/45 px-4 py-4 text-center text-xs text-slate-200/75 backdrop-blur-sm">
      <p>&copy; {new Date().getFullYear()} {config.site.name}. Todos los derechos reservados.</p>
    </div>
  </div>
</footer>
