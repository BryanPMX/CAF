<script>
  import { onMount } from 'svelte';
  import { listenForMediaChange } from '$lib/utils/mediaQuery.js';

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

  function createOptions() {
    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      detectRetina: false,
      fpsLimit: 36,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: {
        detectsOn: 'window',
        events: {
          onClick: { enable: true, mode: 'push' },
          onHover: { enable: true, mode: ['grab', 'repulse'] },
          resize: true
        },
        modes: {
          grab: {
            distance: 185,
            links: { opacity: 0.56 }
          },
          push: { quantity: 3 },
          repulse: { distance: 95, duration: 0.35 }
        }
      },
      particles: {
        color: { value: ['#3d91dc', '#29a99f', '#ec8a68'] },
        links: {
          enable: true,
          color: '#67a9c8',
          distance: 152,
          opacity: 0.22,
          width: 1.1
        },
        move: {
          enable: true,
          speed: 0.58,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' }
        },
        number: {
          value: 48,
          density: { enable: true, width: 1280, height: 800 }
        },
        opacity: {
          value: { min: 0.28, max: 0.68 },
          animation: { enable: true, speed: 0.34, sync: false }
        },
        shape: { type: 'circle' },
        size: {
          value: { min: 1.4, max: 3.8 },
          animation: { enable: true, speed: 0.62, sync: false }
        }
      }
    };
  }

  onMount(() => {
    let disposed = false;
    let particleContainer;
    let initializationRun = 0;
    let idleHandle;
    let fallbackTimer;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const connection = navigator.connection;

    function canRunParticles() {
      return desktopQuery.matches && !reducedMotionQuery.matches && !connection?.saveData && !document.hidden;
    }

    function cancelScheduledInitialization() {
      if (idleHandle !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      idleHandle = undefined;
      fallbackTimer = undefined;
    }

    async function initializeParticles(run) {
      const tsParticles = await getParticlesEngine();
      if (disposed || run !== initializationRun || !host || !canRunParticles()) return;

      const nextContainer = await tsParticles.load({
        id: BACKGROUND_ID,
        element: host,
        options: createOptions()
      });

      if (disposed || run !== initializationRun || !canRunParticles()) {
        nextContainer?.destroy();
        return;
      }

      particleContainer = nextContainer;
    }

    function refreshParticles() {
      const run = ++initializationRun;
      cancelScheduledInitialization();
      particleContainer?.destroy();
      particleContainer = undefined;

      if (!canRunParticles()) return;

      const start = () => {
        idleHandle = undefined;
        fallbackTimer = undefined;
        void initializeParticles(run).catch((error) => {
          console.warn('Live background could not be initialized:', error);
        });
      };

      if ('requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(start, { timeout: 1200 });
      } else {
        fallbackTimer = window.setTimeout(start, 320);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        cancelScheduledInitialization();
        particleContainer?.pause?.();
      } else if (particleContainer) {
        void particleContainer.play?.();
      } else {
        refreshParticles();
      }
    }

    const stopReducedMotionListener = listenForMediaChange(reducedMotionQuery, refreshParticles);
    const stopDesktopListener = listenForMediaChange(desktopQuery, refreshParticles);
    connection?.addEventListener?.('change', refreshParticles);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    refreshParticles();

    return () => {
      disposed = true;
      initializationRun += 1;
      cancelScheduledInitialization();
      stopReducedMotionListener();
      stopDesktopListener();
      connection?.removeEventListener?.('change', refreshParticles);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
