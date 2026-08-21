<script>
  import 'aos/dist/aos.css';
  import { afterNavigate } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import LiveBackground from '$lib/components/LiveBackground.svelte';
  import { initializeAos } from '$lib/utils/aosClient.js';
  import '@fontsource-variable/manrope';
  import '../app.css';

  afterNavigate(() => {
    void initializeAos();
  });
</script>

<div class="site-live-shell min-h-screen font-sans">
  <LiveBackground />

  <div class="site-live-content flex min-h-screen flex-col">
    <Header />

    <main class="flex-grow">
      <slot />
    </main>

    <Footer />
  </div>
</div>
