<script>
  import { onMount } from 'svelte';

  const BACKGROUND_ID = 'caf-live-background-particles';
  let host;

  function createOptions(isMobile) {
    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      detectRetina: !isMobile,
      fpsLimit: isMobile ? 28 : 42,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: {
        detectsOn: 'window',
        events: {
          onClick: { enable: true, mode: 'push' },
          onHover: { enable: !isMobile, mode: 'grab' },
          resize: true
        },
        modes: {
          grab: {
            distance: 145,
            links: { opacity: 0.28 }
          },
          push: { quantity: isMobile ? 1 : 2 }
        }
      },
      particles: {
        color: { value: ['#3d91dc', '#29a99f', '#ec8a68'] },
        links: {
          enable: true,
          color: '#67a9c8',
          distance: isMobile ? 105 : 145,
          opacity: isMobile ? 0.1 : 0.14,
          width: 1
        },
        move: {
          enable: true,
          speed: isMobile ? 0.32 : 0.48,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' }
        },
        number: {
          value: isMobile ? 24 : 48,
          density: { enable: true, width: 1280, height: 800 }
        },
        opacity: {
          value: { min: 0.16, max: 0.38 },
          animation: { enable: true, speed: 0.24, sync: false }
        },
        shape: { type: 'circle' },
        size: {
          value: { min: 1, max: isMobile ? 2.6 : 3.4 },
          animation: { enable: true, speed: 0.5, sync: false }
        }
      }
    };
  }

  onMount(() => {
    let disposed = false;
    let particleContainer;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    async function initializeParticles() {
      const [{ tsParticles }, { loadSlim }] = await Promise.all([
        import('@tsparticles/engine'),
        import('@tsparticles/slim')
      ]);

      await loadSlim(tsParticles);
      if (disposed || !host) return;

      particleContainer = await tsParticles.load({
        id: BACKGROUND_ID,
        element: host,
        options: createOptions(isMobile)
      });
    }

    void initializeParticles().catch((error) => {
      console.warn('Live background could not be initialized:', error);
    });

    return () => {
      disposed = true;
      particleContainer?.destroy();
    };
  });
</script>

<div bind:this={host} class="live-background" aria-hidden="true">
  <span class="live-background__aurora live-background__aurora--blue"></span>
  <span class="live-background__aurora live-background__aurora--teal"></span>
  <span class="live-background__aurora live-background__aurora--warm"></span>
</div>
