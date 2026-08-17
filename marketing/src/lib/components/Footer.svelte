<script>
  import { ArrowUpRight, Mail, MapPin, ShieldCheck } from '@lucide/svelte';
  import { config } from '$lib/config.js';
  import { primaryNavigation } from '$lib/navigation.js';
</script>

<footer class="relative overflow-hidden bg-primary-950 text-slate-200">
  <div class="pointer-events-none absolute -right-32 -top-44 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl"></div>
  <div class="site-container relative py-14 sm:py-16">
    <div class="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-[1.35fr_0.7fr_1fr] md:gap-10">
      <div class="max-w-md">
        <a href="/" class="inline-flex items-center gap-3" aria-label="CAF, ir al inicio">
          <span class="flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img src="/logo-header.webp" alt="" width="160" height="157" class="h-full w-full object-cover" loading="lazy" />
          </span>
          <span class="text-sm font-extrabold leading-snug text-white">Centro de Apoyo<br />para la Familia A.C.</span>
        </a>
        <p class="mt-5 text-sm leading-7 text-slate-300">{config.site.description}. Atención humana, profesional y cercana para cada etapa del proceso.</p>
        <p class="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-accent-300">
          <ShieldCheck size={15} /> Su información se trata con confidencialidad
        </p>
      </div>

      <div>
        <h2 class="text-xs font-extrabold uppercase tracking-[0.14em] text-white">Explorar</h2>
        <ul class="mt-5 space-y-3 text-sm">
          {#each primaryNavigation as link}
            <li><a href={link.href} class="footer-link">{link.label}</a></li>
          {/each}
        </ul>
      </div>

      <div>
        <h2 class="text-xs font-extrabold uppercase tracking-[0.14em] text-white">Contacto</h2>
        <ul class="mt-5 space-y-4 text-sm text-slate-300">
          <li class="flex items-start gap-3">
            <MapPin class="mt-0.5 shrink-0 text-accent-300" size={18} />
            <span>{config.contact.address}</span>
          </li>
          <li>
            <a href="mailto:{config.contact.email}" class="footer-link items-center gap-3">
              <Mail class="shrink-0 text-accent-300" size={18} />
              <span class="break-all">{config.contact.email}</span>
            </a>
          </li>
          <li>
            <a href="/contacto" class="footer-link items-center gap-2 font-bold text-white">
              Ver oficinas y medios de contacto <ArrowUpRight size={16} />
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <p>&copy; {new Date().getFullYear()} {config.site.name}</p>
      <p>Tu tranquilidad es nuestra misión.</p>
    </div>
  </div>
</footer>
