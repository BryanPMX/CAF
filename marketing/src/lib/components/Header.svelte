<script>
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { config } from '$lib/config.js';
  </script>
  
  <!-- Header with sticky behavior and subtle shadow -->
  <header class="bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-50" in:fade={{ duration: 800, easing: cubicOut }}>
	<nav class="container mx-auto px-2 sm:px-4 py-3 flex justify-between items-center">
	  <a href="/" class="flex items-center">
		<img
		  src="/logo.png"
		  alt="Logo del Centro de Apoyo para la Familia"
		  class="h-20 w-auto transition-transform duration-300 hover:scale-110"
		  aria-label="Logo del Centro de Apoyo para la Familia"
		/>
	  </a>
	  
	  <!-- Desktop Menu -->
	  <div class="hidden md:flex items-center space-x-6 text-gray-600 font-medium">
		<a href="/" class="hover:text-blue-600" class:text-blue-600={$page.url.pathname === '/'}>Inicio</a>
		<a href="/servicios" class="hover:text-blue-600" class:text-blue-600={$page.url.pathname === '/servicios'}>Servicios</a>
		<a href="/eventos" class="hover:text-blue-600" class:text-blue-600={$page.url.pathname === '/eventos'}>Eventos</a>
		<a href="/contacto" class="hover:text-blue-600" class:text-blue-600={$page.url.pathname === '/contacto'}>Contacto</a>
	  </div>
  
	  <div class="hidden md:flex">
		<a
		  href={config.api.adminPortalUrl}
		  target="_blank"
		  class="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
		  aria-label="Acceso para clientes"
		>
		  Acceso Clientes
		</a>
	  </div>
	</nav>
  </header>
  
  <style>
	/* Ensure logo remains responsive on smaller screens */
	@media (max-width: 640px) {
	  img {
		height: 4rem; /* Equivalent to h-16 for smaller screens */
	  }
	}
  </style>
