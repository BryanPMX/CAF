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
    const scheduledRevealFrames = new Set();
    const isDesktop = desktopQuery.matches;
    const initialRevealBoundary = isDesktop ? 0.9 : 0.78;
    const entranceBoundary = isDesktop ? 0.95 : 0.8;
    const exitBoundary = isDesktop ? 0.14 : 0.28;
    let runtimeDisposed = false;
    let heroFrame;
    let reconciliationTimer;
    let targetObserver;
    let sceneObserver;
    let heroObserver;
    let mutationObserver;
    let resizeObserver;
    let listenersAttached = false;

    function scheduleTargetReveal(target) {
      target.classList.add('is-motion-pending');

      const firstFrame = requestAnimationFrame(() => {
        scheduledRevealFrames.delete(firstFrame);

        const revealFrame = requestAnimationFrame(() => {
          scheduledRevealFrames.delete(revealFrame);
          if (disposed || runtimeDisposed || !target.isConnected) return;

          target.classList.remove('is-motion-pending');
          seenTargets.add(target);
          target.classList.add('is-motion-visible');
        });

        scheduledRevealFrames.add(revealFrame);
      });

      scheduledRevealFrames.add(firstFrame);
    }

    function setInitialTargetState(target, animateNewTarget = false) {
      if (runtimeDisposed || targets.has(target)) return;

      targets.add(target);
      const order = Number.parseInt(target.dataset.motionOrder || '0', 10);
      target.style.setProperty('--motion-order', String(Number.isFinite(order) ? Math.max(0, Math.min(order, 6)) : 0));

      const rect = target.getBoundingClientRect();
      const currentlyVisible = rect.bottom > window.innerHeight * 0.04 && rect.top < window.innerHeight * initialRevealBoundary;
      const isMobileOpeningScene = !isDesktop
        && window.scrollY < 2
        && rect.top > window.innerHeight * 0.38;
      const animateOnPaint = currentlyVisible
        && (animateNewTarget || target.hasAttribute('data-motion-intro') || isMobileOpeningScene);

      if (currentlyVisible && !animateOnPaint) {
        seenTargets.add(target);
        target.classList.add('is-motion-visible');
      } else if (rect.bottom < window.innerHeight * exitBoundary) {
        seenTargets.add(target);
        target.classList.add(target.dataset.motionExit === 'dissolve' ? 'is-motion-past' : 'is-motion-visible');
      }

      targetObserver.observe(target);
      target.classList.add('is-motion-prepared');

      if (animateOnPaint) scheduleTargetReveal(target);
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
      target.classList.remove('is-motion-prepared', 'is-motion-pending', 'is-motion-visible', 'is-motion-past');
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

      const copy = hero.querySelector('[data-motion-hero-copy]');
      const visual = hero.querySelector('[data-motion-hero-visual]');
      const rect = hero.getBoundingClientRect();
      const startOffset = isDesktop ? 78 : 66;
      const travel = isDesktop
        ? Math.max(rect.height * 0.72, 1)
        : Math.max(Math.min(rect.height * 0.48, window.innerHeight * 0.72), 1);
      const progress = Math.min(1, Math.max(0, (startOffset - rect.top) / travel));
      const previousProgress = heroProgress.get(hero);
      if (previousProgress !== undefined && Math.abs(previousProgress - progress) < 0.001) return;
      heroProgress.set(hero, progress);

      if (copy) {
        const copyTravel = isDesktop ? -72 : -58;
        copy.style.opacity = String(1 - progress * (isDesktop ? 0.84 : 0.9));
        copy.style.transform = `translate3d(0, ${progress * copyTravel}px, 0) scale(${1 - progress * (isDesktop ? 0.035 : 0.05)})`;
      }

      if (visual) {
        const visualTravel = isDesktop ? 68 : 44;
        visual.style.opacity = String(1 - progress * (isDesktop ? 0.56 : 0.68));
        visual.style.transform = `translate3d(0, ${progress * visualTravel}px, 0) scale(${1 - progress * (isDesktop ? 0.07 : 0.06)})`;
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

    function reconcileTargets() {
      reconciliationTimer = undefined;
      if (runtimeDisposed) return;

      targets.forEach((target) => {
        if (!target.isConnected) {
          unregisterTarget(target);
          return;
        }

        if (target.classList.contains('is-motion-pending')) return;

        const rect = target.getBoundingClientRect();
        const insideRevealBand = rect.bottom > window.innerHeight * (isDesktop ? 0.03 : 0.24)
          && rect.top < window.innerHeight * entranceBoundary;

        if (insideRevealBand) {
          seenTargets.add(target);
          target.classList.add('is-motion-visible');
          target.classList.remove('is-motion-past');
        } else if (rect.bottom < window.innerHeight * exitBoundary) {
          seenTargets.add(target);
          target.classList.toggle('is-motion-past', target.dataset.motionExit === 'dissolve');
          target.classList.toggle('is-motion-visible', target.dataset.motionExit !== 'dissolve');
        }
      });
    }

    function handleViewportChange() {
      requestHeroUpdate();
      if (reconciliationTimer !== undefined) window.clearTimeout(reconciliationTimer);
      reconciliationTimer = window.setTimeout(reconcileTargets, 90);
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
        window.removeEventListener('scroll', handleViewportChange);
        window.removeEventListener('resize', handleViewportChange);
      }

      if (heroFrame !== undefined) cancelAnimationFrame(heroFrame);
      if (reconciliationTimer !== undefined) window.clearTimeout(reconciliationTimer);
      scheduledRevealFrames.forEach(cancelAnimationFrame);
      scheduledRevealFrames.clear();

      targets.forEach((target) => {
        target.classList.remove('is-motion-prepared', 'is-motion-pending', 'is-motion-visible', 'is-motion-past');
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
            if (target.classList.contains('is-motion-pending')) return;

            seenTargets.add(target);
            target.classList.add('is-motion-visible');
            target.classList.remove('is-motion-past');
            return;
          }

          if (entry.boundingClientRect.bottom < window.innerHeight * exitBoundary) {
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
        rootMargin: isDesktop ? '-3% 0px -5% 0px' : '-24% 0px -20% 0px',
        threshold: isDesktop ? [0, 0.08, 0.32] : [0, 0.01, 0.22]
      });

      sceneObserver = new IntersectionObserver((entries) => {
        if (runtimeDisposed) return;

        entries.forEach((entry) => {
          entry.target.classList.toggle('is-motion-scene-active', entry.isIntersecting);
        });
      }, {
        rootMargin: isDesktop ? '0px 0px -55% 0px' : '0px 0px -24% 0px',
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

      window.addEventListener('scroll', handleViewportChange, { passive: true });
      window.addEventListener('resize', handleViewportChange, { passive: true });
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
