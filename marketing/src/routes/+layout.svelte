<script>
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import '@fontsource-variable/manrope';
  import '../app.css';
</script>

<div class="flex min-h-screen flex-col bg-transparent font-sans">
  <Header />

  <main class="flex-grow">
    <slot />
  </main>

  <Footer />
</div>
