<script>
  import { page } from '$app/stores';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let mobileMenuOpen = false;

  function toggleMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMenu() {
    mobileMenuOpen = false;
  }

  const navLinks = [
    { href: '/', label: 'Inicio' },
    { href: '/servicios', label: 'Servicios' },
    { href: '/eventos', label: 'Eventos' },
    { href: '/contacto', label: 'Contacto' },
  ];
</script>

<header class="sticky top-0 z-50 border-b border-white/50 bg-white/30 backdrop-blur-2xl shadow-[0_12px_32px_rgba(14,45,78,0.12)]">
  <div class="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden">
    <div class="spotlight -left-40 -top-8 h-24 w-72 bg-primary-300"></div>
    <div class="spotlight -right-32 -top-10 h-24 w-64 bg-accent-400"></div>
  </div>

  <nav class="relative flex w-full items-center justify-between border-b border-white/40 bg-white/20 px-2 py-3 backdrop-blur-2xl sm:px-4 lg:px-6">
    <a href="/" class="group flex items-center gap-3" on:click={closeMenu}>
      <span class="brand-logo-shell">
        <span class="block rounded-[0.95rem] bg-white p-1.5">
          <img
            src="/logo-header.jpg"
            alt="Logo del Centro de Apoyo para la Familia"
            class="h-12 w-16 rounded-xl object-contain sm:h-14 sm:w-20"
          />
        </span>
      </span>
      <span class="hidden lg:block">
        <span class="block text-sm font-bold text-slate-800">Centro de Apoyo para la Familia</span>
        <span class="block text-xs font-medium tracking-[0.04em] text-slate-500">Atención integral y profesional</span>
      </span>
    </a>

    <div class="glass-subtle absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 rounded-full px-8 py-2 md:flex">
      {#each navLinks as link}
        <a
          href={link.href}
          data-sveltekit-reload={link.href === '/servicios'}
          class="group relative rounded-full px-3 py-1.5 text-lg font-semibold tracking-[0.02em] transition-colors duration-200 hover:bg-white/45"
          class:text-primary-700={$page.url.pathname === link.href}
          class:text-slate-600={$page.url.pathname !== link.href}
        >
          {link.label}
          <span
            class="absolute -bottom-[1px] left-0 h-0.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
            class:w-full={$page.url.pathname === link.href}
            class:opacity-100={$page.url.pathname === link.href}
            class:w-0={$page.url.pathname !== link.href}
            class:opacity-0={$page.url.pathname !== link.href}
          ></span>
        </a>
      {/each}
    </div>

    <button
      class="ml-auto rounded-xl border border-white/60 bg-white/40 p-2 text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/65 md:hidden"
      on:click={toggleMenu}
      aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={mobileMenuOpen}
    >
      {#if mobileMenuOpen}
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      {:else}
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      {/if}
    </button>
  </nav>

  {#if mobileMenuOpen}
    <div
      class="md:hidden border-t border-white/50 bg-white/45 shadow-[0_20px_40px_rgba(10,36,67,0.16)] backdrop-blur-2xl"
      transition:slide={{ duration: 250, easing: cubicOut }}
    >
      <div class="container mx-auto space-y-1 px-4 py-4">
        {#each navLinks as link}
          <a
            href={link.href}
            data-sveltekit-reload={link.href === '/servicios'}
            class="glass-subtle block rounded-xl px-4 py-3 text-sm font-semibold transition-all"
            class:bg-primary-50={$page.url.pathname === link.href}
            class:text-primary-700={$page.url.pathname === link.href}
            class:text-slate-600={$page.url.pathname !== link.href}
            class:hover:bg-slate-50={$page.url.pathname !== link.href}
            on:click={closeMenu}
          >
            {link.label}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</header>
