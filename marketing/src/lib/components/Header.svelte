<script>
  import { page } from '$app/stores';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { config } from '$lib/config.js';

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

<header class="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100">
  <nav class="w-full px-4 sm:px-6 py-3 flex justify-between items-center">
    <!-- Logo: far left, zoomed so initials read larger; wider wrapper to avoid left/right crop -->
    <a href="/" class="flex items-center flex-shrink-0 overflow-hidden rounded-sm" on:click={closeMenu}>
      <span class="inline-flex h-14 w-20 sm:h-16 sm:w-24 md:h-20 md:w-28 items-center justify-center overflow-hidden">
        <img
          src="/logo.png"
          alt="Logo del Centro de Apoyo para la Familia"
          class="h-14 w-auto sm:h-16 md:h-20 origin-center scale-125 sm:scale-[1.35] md:scale-150"
        />
      </span>
    </a>

    <!-- Desktop Navigation -->
    <div class="hidden md:flex items-center gap-8">
      {#each navLinks as link}
        <a
          href={link.href}
          data-sveltekit-reload={link.href === '/servicios'}
          class="text-base font-medium transition-colors duration-200 hover:text-primary-600 relative py-1"
          class:text-primary-600={$page.url.pathname === link.href}
          class:text-gray-600={$page.url.pathname !== link.href}
        >
          {link.label}
          {#if $page.url.pathname === link.href}
            <span class="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary-600 rounded-full"></span>
          {/if}
        </a>
      {/each}
    </div>

    <!-- Desktop CTA -->
    <div class="hidden md:flex">
      <a
        href={config.api.adminPortalUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold text-sm py-2.5 px-6 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        Acceso Clientes
      </a>
    </div>

    <!-- Mobile Hamburger -->
    <button
      class="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
      on:click={toggleMenu}
      aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={mobileMenuOpen}
    >
      {#if mobileMenuOpen}
        <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      {:else}
        <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      {/if}
    </button>
  </nav>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div
      class="md:hidden bg-white border-t border-gray-100 shadow-lg"
      transition:slide={{ duration: 250, easing: cubicOut }}
    >
      <div class="container mx-auto px-4 py-4 space-y-1">
        {#each navLinks as link}
          <a
            href={link.href}
            data-sveltekit-reload={link.href === '/servicios'}
            class="block py-3.5 px-4 rounded-lg text-base font-medium transition-colors"
            class:bg-primary-50={$page.url.pathname === link.href}
            class:text-primary-700={$page.url.pathname === link.href}
            class:text-gray-600={$page.url.pathname !== link.href}
            class:hover:bg-gray-50={$page.url.pathname !== link.href}
            on:click={closeMenu}
          >
            {link.label}
          </a>
        {/each}
        <div class="pt-2 border-t border-gray-100">
          <a
            href={config.api.adminPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="block text-center bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold text-sm py-3 px-6 rounded-lg"
            on:click={closeMenu}
          >
            Acceso Clientes
          </a>
        </div>
      </div>
    </div>
  {/if}
</header>
