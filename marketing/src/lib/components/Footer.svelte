<script>
  import { config } from '$lib/config.js';
</script>

<footer class="relative overflow-hidden bg-slate-950 text-slate-300">
  <div class="pointer-events-none absolute inset-0">
    <div class="spotlight -left-20 top-8 h-52 w-72 bg-primary-500/60"></div>
    <div class="spotlight right-0 top-0 h-56 w-72 bg-accent-500/55"></div>
  </div>

  <div class="relative h-[3px] bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500"></div>

  <div class="container relative mx-auto px-6 py-10 sm:py-12">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
      <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_16px_34px_rgba(1,8,19,0.26)]">
        <div class="mb-4 flex items-center gap-3">
          <span class="brand-logo-shell">
            <span class="block rounded-[0.95rem] bg-white p-1.5">
              <img src="/logo-footer.png" alt="Logo CAF" class="h-12 w-12 object-contain sm:h-14 sm:w-14" />
            </span>
          </span>
          <span class="text-lg font-bold text-white">{config.site.name}</span>
        </div>
        <p class="max-w-md text-sm leading-relaxed text-slate-300/85">
          {config.site.description}
        </p>
      </div>

      <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_16px_34px_rgba(1,8,19,0.26)]">
        <h4 class="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">Navegación</h4>
        <ul class="space-y-2.5">
          <li>
            <a href="/" class="group inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:translate-x-1 hover:text-white">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-400 transition-colors duration-200 group-hover:bg-accent-400"></span>
              Inicio
            </a>
          </li>
          <li>
            <a href="/servicios" data-sveltekit-reload class="group inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:translate-x-1 hover:text-white">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-400 transition-colors duration-200 group-hover:bg-accent-400"></span>
              Servicios
            </a>
          </li>
          <li>
            <a href="/eventos" class="group inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:translate-x-1 hover:text-white">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-400 transition-colors duration-200 group-hover:bg-accent-400"></span>
              Eventos
            </a>
          </li>
          <li>
            <a href="/contacto" class="group inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:translate-x-1 hover:text-white">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-400 transition-colors duration-200 group-hover:bg-accent-400"></span>
              Contacto
            </a>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_16px_34px_rgba(1,8,19,0.26)]">
        <h4 class="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">Contacto</h4>
        <ul class="space-y-3 text-sm text-slate-300/90">
          <li class="flex items-start gap-2.5">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{config.contact.address}</span>
          </li>
          <li>
            <a href="mailto:{config.contact.email}" class="inline-flex items-center gap-2.5 text-sm text-slate-300/90 transition-colors duration-200 hover:text-white">
              <svg class="h-4 w-4 flex-shrink-0 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{config.contact.email}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-400">
      <p>&copy; {new Date().getFullYear()} {config.site.name}. Todos los derechos reservados.</p>
    </div>
  </div>
</footer>
