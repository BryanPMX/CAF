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

<header class="sticky top-0 z-50 border-b border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_10px_24px_rgba(20,43,79,0.1)]">
  <div class="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden">
    <div class="spotlight -left-40 -top-8 h-24 w-72 bg-primary-300"></div>
    <div class="spotlight -right-32 -top-10 h-24 w-64 bg-accent-400"></div>
  </div>

  <nav class="relative flex w-full items-center justify-between px-2 py-3 sm:px-4 lg:px-6">
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

    <div class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-11 md:flex">
      {#each navLinks as link}
        <a
          href={link.href}
          data-sveltekit-reload={link.href === '/servicios'}
          class="nav-link text-lg font-semibold tracking-[0.02em]"
          class:is-active={$page.url.pathname === link.href}
          class:text-primary-700={$page.url.pathname === link.href}
          class:text-slate-600={$page.url.pathname !== link.href}
        >
          {link.label}
        </a>
      {/each}
    </div>

    <button
      class="ml-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 md:hidden"
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
      class="md:hidden border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur-xl"
      transition:slide={{ duration: 250, easing: cubicOut }}
    >
      <div class="container mx-auto space-y-1 px-4 py-4">
        {#each navLinks as link}
          <a
            href={link.href}
            data-sveltekit-reload={link.href === '/servicios'}
            class="block rounded-lg px-4 py-3 text-base font-semibold transition-colors"
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
