<script>
  import { afterNavigate } from '$app/navigation';
  import { onDestroy, tick } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import LiveBackground from '$lib/components/LiveBackground.svelte';
  import { initializeMotionController } from '$lib/utils/motionController.js';
  import '@fontsource-variable/manrope';
  import '../app.css';

  let destroyMotion = () => {};
  let motionRun = 0;

  afterNavigate(async () => {
    const run = ++motionRun;
    destroyMotion();
    destroyMotion = () => {};

    await tick();
    if (run !== motionRun) return;

    destroyMotion = initializeMotionController();
  });

  onDestroy(() => {
    motionRun += 1;
    destroyMotion();
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
