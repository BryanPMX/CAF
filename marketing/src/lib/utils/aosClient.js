let aos;
let initializationPromise;
let initialized = false;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Initializes AOS once and refreshes it on subsequent client-side navigations.
 * Keeping the configuration here gives every animated section the same motion language.
 */
export async function initializeAos() {
  if (typeof window === 'undefined') return;

  document.querySelectorAll('[data-aos]').forEach((element) => {
    if (!element.hasAttribute('data-aos-once')) {
      element.setAttribute('data-aos-once', 'false');
    }
  });

  if (!initializationPromise) {
    initializationPromise = import('aos').then((module) => module.default ?? module);
  }

  aos = await initializationPromise;

  if (!initialized) {
    aos.init({
      duration: 680,
      easing: 'ease-out-cubic',
      offset: 24,
      once: false,
      anchorPlacement: 'top-bottom',
      disable: prefersReducedMotion
    });
    initialized = true;
  } else {
    aos.refreshHard();
  }

  requestAnimationFrame(() => aos.refresh());
}
