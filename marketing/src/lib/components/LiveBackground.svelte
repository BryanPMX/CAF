<script>
  import { onMount } from 'svelte';

  const BACKGROUND_ID = 'caf-live-background-particles';
  const ENGINE_PROMISE_KEY = '__cafTsParticlesSlimReady';
  let host;

  async function getParticlesEngine() {
    const [{ tsParticles }, { loadSlim }] = await Promise.all([
      import('@tsparticles/engine'),
      import('@tsparticles/slim')
    ]);

    if (!window[ENGINE_PROMISE_KEY]) {
      window[ENGINE_PROMISE_KEY] = loadSlim(tsParticles)
        .then(() => tsParticles)
        .catch((error) => {
          if (String(error).includes('Register plugins can only be done before calling tsParticles.load')) {
            return tsParticles;
          }

          delete window[ENGINE_PROMISE_KEY];
          throw error;
        });
    }

    return window[ENGINE_PROMISE_KEY];
  }

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
          onHover: { enable: !isMobile, mode: ['grab', 'repulse'] },
          resize: true
        },
        modes: {
          grab: {
            distance: 185,
            links: { opacity: 0.56 }
          },
          push: { quantity: isMobile ? 2 : 4 },
          repulse: { distance: 95, duration: 0.35 }
        }
      },
      particles: {
        color: { value: ['#3d91dc', '#29a99f', '#ec8a68'] },
        links: {
          enable: true,
          color: '#67a9c8',
          distance: isMobile ? 112 : 158,
          opacity: isMobile ? 0.18 : 0.25,
          width: 1.1
        },
        move: {
          enable: true,
          speed: isMobile ? 0.46 : 0.72,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' }
        },
        number: {
          value: isMobile ? 34 : 64,
          density: { enable: true, width: 1280, height: 800 }
        },
        opacity: {
          value: { min: 0.28, max: 0.68 },
          animation: { enable: true, speed: 0.34, sync: false }
        },
        shape: { type: 'circle' },
        size: {
          value: { min: 1.4, max: isMobile ? 3.2 : 4.2 },
          animation: { enable: true, speed: 0.62, sync: false }
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
      const tsParticles = await getParticlesEngine();
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
  <span class="live-background__grid"></span>
  <span class="live-background__aurora live-background__aurora--blue"></span>
  <span class="live-background__aurora live-background__aurora--teal"></span>
  <span class="live-background__aurora live-background__aurora--warm"></span>
</div>
