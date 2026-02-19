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

<header class="header-shell sticky top-0 z-50 border-b border-white/45 bg-white/70 backdrop-blur-2xl shadow-[0_14px_34px_rgba(15,30,58,0.14)]">
  <div class="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden">
    <div class="spotlight -left-40 -top-8 h-24 w-72 bg-primary-300/90"></div>
    <div class="spotlight -right-32 -top-10 h-24 w-64 bg-accent-400/90"></div>
    <div class="spotlight left-1/2 -top-10 h-24 w-64 -translate-x-1/2 bg-[rgba(166,133,255,0.38)]"></div>
  </div>

  <nav class="relative flex w-full items-center py-3 pl-1 pr-3 sm:pl-2 sm:pr-4 lg:pl-4 lg:pr-6">
    <a href="/" class="group flex min-w-fit items-center gap-3 pr-2 md:pr-6" on:click={closeMenu}>
      <img
        src="/logo-header.jpg"
        alt="Logo del Centro de Apoyo para la Familia"
        width="522"
        height="512"
        class="header-logo h-12 w-16 rounded-xl object-contain sm:h-14 sm:w-20"
      />
      <span class="hidden lg:block">
        <span class="block text-sm font-bold text-slate-800">Centro de Apoyo para la Familia A.C.</span>
        <span class="block text-xs font-semibold tracking-[0.045em] text-slate-600/85">Atención integral y profesional</span>
      </span>
    </a>

    <div class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex lg:gap-11">
      {#each navLinks as link}
        <a
          href={link.href}
          class="touch-target nav-link rounded-full px-3.5 py-1.5 text-[1.04rem] font-semibold tracking-[0.015em]"
          class:is-active={$page.url.pathname === link.href}
          class:text-primary-700={$page.url.pathname === link.href}
          class:text-slate-700={$page.url.pathname !== link.href}
        >
          {link.label}
        </a>
      {/each}
    </div>

    <button
      class="touch-target ml-auto rounded-xl border border-white/70 bg-white/85 p-2.5 text-slate-700 shadow-[0_8px_20px_rgba(15,30,58,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white md:hidden"
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
      class="md:hidden border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,237,255,0.9))] shadow-[0_20px_34px_rgba(15,30,58,0.16)] backdrop-blur-2xl"
      transition:slide={{ duration: 250, easing: cubicOut }}
    >
      <div class="container mx-auto space-y-1 px-4 py-4">
        {#each navLinks as link}
          <a
            href={link.href}
            class="touch-target block rounded-xl border border-transparent px-4 py-3 text-base font-semibold transition-all duration-200 hover:border-primary-200/65 hover:bg-white/75"
            class:bg-primary-50={$page.url.pathname === link.href}
            class:text-primary-700={$page.url.pathname === link.href}
            class:text-slate-700={$page.url.pathname !== link.href}
            on:click={closeMenu}
          >
            {link.label}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</header>
