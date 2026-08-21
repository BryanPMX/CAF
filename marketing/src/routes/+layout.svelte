<script>
  import 'aos/dist/aos.css';
  import { afterNavigate } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { initializeAos } from '$lib/utils/aosClient.js';
  import '@fontsource-variable/manrope';
  import '../app.css';

  afterNavigate(() => {
    void initializeAos();
  });
</script>

<div class="flex min-h-screen flex-col bg-transparent font-sans">
  <Header />

  <main class="flex-grow">
    <slot />
  </main>

  <Footer />
</div>
