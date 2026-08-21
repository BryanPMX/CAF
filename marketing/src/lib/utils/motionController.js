import { listenForMediaChange } from './mediaQuery.js';

const MOTION_TARGET = '[data-motion]';
const MOTION_SCENE = '[data-motion-scene]';
const MOTION_HERO = '[data-motion-hero]';
const READY_CLASS = 'motion-ready';

function noop() {}

function asElements(node, selector) {
  if (!(node instanceof Element)) return [];

  const matches = node.matches(selector) ? [node] : [];
  return matches.concat([...node.querySelectorAll(selector)]);
}

/**
 * Owns the complete site motion lifecycle.
 *
 * Content is visible by default and is only prepared after every observer has
 * been registered successfully. This keeps route rendering fail-open if the
 * browser lacks an API or initialization is interrupted.
 */
export function initializeMotionController(root) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;

  const resolvedRoot = root ?? document;
  const scope = resolvedRoot === document ? document : resolvedRoot;
  const observedRoot = resolvedRoot === document ? document.body : resolvedRoot;
  if (!observedRoot || typeof scope?.querySelectorAll !== 'function') return noop;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  let disposed = false;
  let destroyRuntime = noop;

  function createRuntime() {
    if (reducedMotionQuery.matches || typeof IntersectionObserver === 'undefined') {
      document.documentElement.classList.remove(READY_CLASS);
      return noop;
    }

    const targets = new Set();
    const scenes = new Set();
    const heroes = new Set();
    const activeHeroes = new Set();
    const seenTargets = new WeakSet();
    const heroProgress = new WeakMap();
    let runtimeDisposed = false;
    let heroFrame;
    let targetObserver;
    let sceneObserver;
    let heroObserver;
    let mutationObserver;
    let resizeObserver;
    let listenersAttached = false;

    function setInitialTargetState(target, animateNewTarget = false) {
      if (runtimeDisposed || targets.has(target)) return;

      targets.add(target);
      const order = Number.parseInt(target.dataset.motionOrder || '0', 10);
      target.style.setProperty('--motion-order', String(Number.isFinite(order) ? Math.max(0, Math.min(order, 6)) : 0));

      const rect = target.getBoundingClientRect();
      const currentlyVisible = rect.bottom > window.innerHeight * 0.04 && rect.top < window.innerHeight * 0.9;

      if (currentlyVisible && !animateNewTarget) {
        seenTargets.add(target);
        target.classList.add('is-motion-visible');
      } else if (rect.bottom < window.innerHeight * 0.14) {
        seenTargets.add(target);
        target.classList.add(target.dataset.motionExit === 'dissolve' ? 'is-motion-past' : 'is-motion-visible');
      }

      targetObserver.observe(target);
      target.classList.add('is-motion-prepared');

      if (currentlyVisible && animateNewTarget) {
        requestAnimationFrame(() => {
          if (!disposed && !runtimeDisposed && target.isConnected) {
            seenTargets.add(target);
            target.classList.add('is-motion-visible');
          }
        });
      }
    }

    function registerScene(scene) {
      if (runtimeDisposed || scenes.has(scene)) return;
      scenes.add(scene);
      sceneObserver.observe(scene);
    }

    function registerHero(hero) {
      if (runtimeDisposed || heroes.has(hero)) return;
      heroes.add(hero);
      heroObserver.observe(hero);
      resizeObserver?.observe(hero);
    }

    function unregisterTarget(target) {
      if (!targets.delete(target)) return;
      targetObserver.unobserve(target);
      seenTargets.delete(target);
      target.classList.remove('is-motion-prepared', 'is-motion-visible', 'is-motion-past');
      target.style.removeProperty('--motion-order');
    }

    function unregisterScene(scene) {
      if (!scenes.delete(scene)) return;
      sceneObserver.unobserve(scene);
      scene.classList.remove('is-motion-scene-active');
    }

    function unregisterHero(hero) {
      if (!heroes.delete(hero)) return;
      activeHeroes.delete(hero);
      heroObserver.unobserve(hero);
      resizeObserver?.unobserve(hero);
      heroProgress.delete(hero);

      const copy = hero.querySelector('[data-motion-hero-copy]');
      const visual = hero.querySelector('[data-motion-hero-visual]');
      copy?.style.removeProperty('opacity');
      copy?.style.removeProperty('transform');
      visual?.style.removeProperty('opacity');
      visual?.style.removeProperty('transform');
    }

    function updateHero(hero) {
      if (!hero.isConnected) {
        unregisterHero(hero);
        return;
      }

      const isDesktop = desktopQuery.matches;
      const copy = hero.querySelector('[data-motion-hero-copy]');
      const visual = hero.querySelector('[data-motion-hero-visual]');
      const rect = hero.getBoundingClientRect();
      const startOffset = isDesktop ? 78 : 66;
      const travel = Math.max(rect.height * (isDesktop ? 0.72 : 0.62), 1);
      const progress = Math.min(1, Math.max(0, (startOffset - rect.top) / travel));
      const previousProgress = heroProgress.get(hero);
      if (previousProgress !== undefined && Math.abs(previousProgress - progress) < 0.001) return;
      heroProgress.set(hero, progress);

      if (copy) {
        const copyTravel = isDesktop ? -72 : -46;
        copy.style.opacity = String(1 - progress * 0.84);
        copy.style.transform = `translate3d(0, ${progress * copyTravel}px, 0) scale(${1 - progress * 0.035})`;
      }

      if (visual) {
        const visualTravel = isDesktop ? 68 : 40;
        visual.style.opacity = String(1 - progress * 0.56);
        visual.style.transform = `translate3d(0, ${progress * visualTravel}px, 0) scale(${1 - progress * (isDesktop ? 0.07 : 0.045)})`;
      }
    }

    function updateHeroes() {
      heroFrame = undefined;
      if (runtimeDisposed) return;
      activeHeroes.forEach(updateHero);
    }

    function requestHeroUpdate() {
      if (runtimeDisposed || activeHeroes.size === 0 || heroFrame !== undefined) return;
      heroFrame = requestAnimationFrame(updateHeroes);
    }

    function cleanupRuntime() {
      if (runtimeDisposed) return;
      runtimeDisposed = true;
      document.documentElement.classList.remove(READY_CLASS);
      targetObserver?.disconnect();
      sceneObserver?.disconnect();
      heroObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();

      if (listenersAttached) {
        window.removeEventListener('scroll', requestHeroUpdate);
        window.removeEventListener('resize', requestHeroUpdate);
      }

      if (heroFrame !== undefined) cancelAnimationFrame(heroFrame);

      targets.forEach((target) => {
        target.classList.remove('is-motion-prepared', 'is-motion-visible', 'is-motion-past');
        target.style.removeProperty('--motion-order');
      });
      scenes.forEach((scene) => scene.classList.remove('is-motion-scene-active'));
      heroes.forEach((hero) => {
        const copy = hero.querySelector('[data-motion-hero-copy]');
        const visual = hero.querySelector('[data-motion-hero-visual]');
        copy?.style.removeProperty('opacity');
        copy?.style.removeProperty('transform');
        visual?.style.removeProperty('opacity');
        visual?.style.removeProperty('transform');
      });
    }

    try {
      targetObserver = new IntersectionObserver((entries) => {
        if (runtimeDisposed) return;

        entries.forEach((entry) => {
          const target = entry.target;

          if (entry.isIntersecting) {
            seenTargets.add(target);
            target.classList.add('is-motion-visible');
            target.classList.remove('is-motion-past');
            return;
          }

          if (entry.boundingClientRect.bottom < window.innerHeight * 0.14) {
            if (target.dataset.motionExit === 'dissolve') {
              target.classList.add('is-motion-past');
              target.classList.remove('is-motion-visible');
            } else if (seenTargets.has(target)) {
              target.classList.add('is-motion-visible');
            }
          } else if (!seenTargets.has(target)) {
            target.classList.remove('is-motion-visible', 'is-motion-past');
          }
        });
      }, {
        rootMargin: '-3% 0px -5% 0px',
        threshold: [0, 0.08, 0.32]
      });

      sceneObserver = new IntersectionObserver((entries) => {
        if (runtimeDisposed) return;

        entries.forEach((entry) => {
          entry.target.classList.toggle('is-motion-scene-active', entry.isIntersecting);
        });
      }, {
        rootMargin: '0px 0px -55% 0px',
        threshold: 0.01
      });

      heroObserver = new IntersectionObserver((entries) => {
        if (runtimeDisposed) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeHeroes.add(entry.target);
          } else {
            activeHeroes.delete(entry.target);
            updateHero(entry.target);
          }
        });
        requestHeroUpdate();
      }, {
        rootMargin: '12% 0px 12% 0px',
        threshold: 0
      });

      resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(requestHeroUpdate);

      [...scope.querySelectorAll(MOTION_TARGET)].forEach((target) => setInitialTargetState(target));
      [...scope.querySelectorAll(MOTION_SCENE)].forEach(registerScene);
      [...scope.querySelectorAll(MOTION_HERO)].forEach(registerHero);

      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver((records) => {
          if (runtimeDisposed) return;

          records.forEach((record) => {
            record.removedNodes.forEach((node) => {
              asElements(node, MOTION_TARGET).forEach(unregisterTarget);
              asElements(node, MOTION_SCENE).forEach(unregisterScene);
              asElements(node, MOTION_HERO).forEach(unregisterHero);
            });
          });

          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              asElements(node, MOTION_TARGET).forEach((target) => setInitialTargetState(target, true));
              asElements(node, MOTION_SCENE).forEach(registerScene);
              asElements(node, MOTION_HERO).forEach(registerHero);
            });
          });
          requestHeroUpdate();
        });
        mutationObserver.observe(observedRoot, { childList: true, subtree: true });
      }

      window.addEventListener('scroll', requestHeroUpdate, { passive: true });
      window.addEventListener('resize', requestHeroUpdate, { passive: true });
      listenersAttached = true;

      document.documentElement.classList.add(READY_CLASS);
      heroes.forEach(updateHero);

      return cleanupRuntime;
    } catch (error) {
      cleanupRuntime();
      throw error;
    }
  }

  function rebuildRuntime() {
    destroyRuntime();
    destroyRuntime = noop;
    if (disposed) return;

    try {
      destroyRuntime = createRuntime();
    } catch (error) {
      document.documentElement.classList.remove(READY_CLASS);
      console.warn('Motion enhancements could not be initialized:', error);
    }
  }

  const stopReducedMotionListener = listenForMediaChange(reducedMotionQuery, rebuildRuntime);
  const stopDesktopListener = listenForMediaChange(desktopQuery, rebuildRuntime);
  rebuildRuntime();

  return () => {
    disposed = true;
    stopReducedMotionListener();
    stopDesktopListener();
    destroyRuntime();
  };
}
