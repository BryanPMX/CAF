<script>
  import { page } from '$app/stores';
  import { ArrowRight, Menu, ShieldCheck, X } from '@lucide/svelte';
  import { primaryNavigation } from '$lib/navigation.js';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let mobileMenuOpen = false;

  function isActive(href) {
    return href === '/' ? $page.url.pathname === href : $page.url.pathname.startsWith(href);
  }
</script>

<header class="header-shell sticky top-0 z-50">
  <nav class="site-container flex min-h-[4.75rem] items-center gap-5" aria-label="Navegación principal">
    <a href="/" class="flex min-w-0 items-center gap-3" on:click={() => mobileMenuOpen = false} aria-label="CAF, ir al inicio">
      <span class="flex h-12 w-[4.8rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <img src="/logo-header.webp" alt="" width="160" height="157" class="h-full w-full object-cover" />
      </span>
      <span class="hidden min-w-0 lg:block">
        <span class="block truncate text-sm font-extrabold tracking-[-0.015em] text-primary-950">Centro de Apoyo para la Familia</span>
        <span class="mt-0.5 flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-accent-700">
          <ShieldCheck size={13} strokeWidth={2.4} /> Atención confidencial
        </span>
      </span>
    </a>

    <div class="ml-auto hidden items-center gap-1 md:flex">
      {#each primaryNavigation as link}
        <a
          href={link.href}
          class="nav-link touch-target rounded-full px-4 py-2"
          class:is-active={isActive(link.href)}
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          {link.label}
        </a>
      {/each}
    </div>

    <a href="/contacto" class="button-primary ml-1 hidden min-h-[2.85rem] px-5 lg:inline-flex">
      Solicitar orientación <ArrowRight size={17} strokeWidth={2.2} />
    </a>

    <button
      class="touch-target ml-auto inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-primary-950 shadow-sm md:hidden"
      on:click={() => mobileMenuOpen = !mobileMenuOpen}
      aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={mobileMenuOpen}
      aria-controls="mobile-navigation"
    >
      {#if mobileMenuOpen}<X size={23} />{:else}<Menu size={23} />{/if}
    </button>
  </nav>

  {#if mobileMenuOpen}
    <div id="mobile-navigation" class="border-t border-slate-200 bg-white md:hidden" transition:slide={{ duration: 220, easing: cubicOut }}>
      <div class="site-container space-y-1 py-4">
        {#each primaryNavigation as link}
          <a
            href={link.href}
            class="touch-target flex items-center justify-between rounded-xl px-4 py-3 font-bold"
            class:bg-primary-50={isActive(link.href)}
            class:text-primary-700={isActive(link.href)}
            class:text-slate-700={!isActive(link.href)}
            aria-current={isActive(link.href) ? 'page' : undefined}
            on:click={() => mobileMenuOpen = false}
          >
            {link.label}<ArrowRight size={17} />
          </a>
        {/each}
        <a href="/contacto" class="button-primary mt-3 flex w-full" on:click={() => mobileMenuOpen = false}>Solicitar orientación</a>
      </div>
    </div>
  {/if}
</header>
