import { listenForMediaChange } from './mediaQuery.js';

const MOTION_TARGET = '[data-motion]';
const MOTION_SCENE = '[data-motion-scene]';
const MOTION_HERO = '[data-motion-hero]';
const READY_CLASS = 'motion-ready';
const TARGET_STATE = Object.freeze({
  BEFORE: 'before',
  ACTIVE: 'active',
  PAST: 'past'
});
const LIVE_RECONCILIATION_INTERVAL = 48;

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
    if (typeof IntersectionObserver === 'undefined') {
      document.documentElement.classList.remove(READY_CLASS);
      return noop;
    }

    const targets = new Set();
    const scenes = new Set();
    const heroes = new Set();
    const activeHeroes = new Set();
    const activatedTargets = new WeakSet();
    const endPromotedTargets = new WeakSet();
    const heroProgress = new WeakMap();
    const scheduledRevealFrames = new Set();
    const isReducedMotion = reducedMotionQuery.matches;
    const isDesktop = desktopQuery.matches;
    const entranceBoundary = isDesktop ? 0.95 : 0.8;
    const exitBoundary = isDesktop ? 0.14 : 0.28;
    const stateHysteresis = isDesktop ? 18 : 14;
    let runtimeDisposed = false;
    let heroFrame;
    let targetFrame;
    let forceTargetReconciliation = false;
    let lastTargetReconciliation = 0;
    let reconciliationTimer;
    let targetObserver;
    let sceneObserver;
    let heroObserver;
    let mutationObserver;
    let resizeObserver;
    let listenersAttached = false;

    function hasReachedDocumentEnd() {
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );

      return window.scrollY + window.innerHeight >= documentHeight - 2;
    }

    function getCurrentTargetState(target) {
      if (target.classList.contains('is-motion-past')) return TARGET_STATE.PAST;
      if (target.classList.contains('is-motion-visible')) return TARGET_STATE.ACTIVE;
      return TARGET_STATE.BEFORE;
    }

    function setTargetState(target, requestedState) {
      const exitMode = target.dataset.motionExit || 'replay';
      const nextState = exitMode === 'once'
        && activatedTargets.has(target)
        && requestedState !== TARGET_STATE.ACTIVE
        ? TARGET_STATE.ACTIVE
        : requestedState;

      if (getCurrentTargetState(target) === nextState) return;

      target.classList.toggle('is-motion-visible', nextState === TARGET_STATE.ACTIVE);
      target.classList.toggle('is-motion-past', nextState === TARGET_STATE.PAST);

      if (nextState === TARGET_STATE.ACTIVE) activatedTargets.add(target);
    }

    function resolveTargetState(target, rect, atDocumentEnd = false) {
      const viewportHeight = window.innerHeight;
      const entranceLine = viewportHeight * entranceBoundary;
      const exitLine = viewportHeight * exitBoundary;
      const targetExitLine = target.hasAttribute('data-motion-intro') ? 0 : exitLine;
      const intersectsViewport = rect.bottom > 0 && rect.top < viewportHeight;
      const currentState = getCurrentTargetState(target);

      if (
        atDocumentEnd
        && intersectsViewport
        && rect.bottom > targetExitLine + stateHysteresis
      ) {
        if (
          currentState === TARGET_STATE.BEFORE
          && rect.top >= entranceLine - stateHysteresis
        ) {
          endPromotedTargets.add(target);
        }
        return TARGET_STATE.ACTIVE;
      }

      if (endPromotedTargets.has(target)) {
        if (rect.top < viewportHeight && rect.bottom > 0) return TARGET_STATE.ACTIVE;
        endPromotedTargets.delete(target);
      }

      if (currentState === TARGET_STATE.ACTIVE) {
        if (rect.bottom <= targetExitLine - stateHysteresis) return TARGET_STATE.PAST;
        if (rect.top >= entranceLine + stateHysteresis) return TARGET_STATE.BEFORE;
        return TARGET_STATE.ACTIVE;
      }

      if (currentState === TARGET_STATE.PAST) {
        if (rect.top >= entranceLine + stateHysteresis) return TARGET_STATE.BEFORE;
        return rect.bottom > targetExitLine + stateHysteresis
          ? TARGET_STATE.ACTIVE
          : TARGET_STATE.PAST;
      }

      if (rect.bottom <= targetExitLine - stateHysteresis) return TARGET_STATE.PAST;
      return rect.top < entranceLine - stateHysteresis
        ? TARGET_STATE.ACTIVE
        : TARGET_STATE.BEFORE;
    }

    function scheduleTargetReveal(target) {
      target.classList.add('is-motion-pending');

      const firstFrame = requestAnimationFrame(() => {
        scheduledRevealFrames.delete(firstFrame);

        const revealFrame = requestAnimationFrame(() => {
          scheduledRevealFrames.delete(revealFrame);
          if (disposed || runtimeDisposed || !target.isConnected) return;

          target.classList.remove('is-motion-pending');
          const rect = target.getBoundingClientRect();
          setTargetState(target, resolveTargetState(target, rect, hasReachedDocumentEnd()));
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
      const initialState = resolveTargetState(target, rect, hasReachedDocumentEnd());
      const isMobileOpeningScene = !isDesktop
        && window.scrollY < 2
        && rect.top > window.innerHeight * 0.38;
      const animateOnPaint = initialState === TARGET_STATE.ACTIVE
        && (
          animateNewTarget
          || target.hasAttribute('data-motion-intro')
          || target.hasAttribute('data-motion-order')
          || isMobileOpeningScene
        );

      if (isReducedMotion) {
        target.classList.add('is-motion-prepared');

        if (initialState === TARGET_STATE.ACTIVE && target.hasAttribute('data-motion-intro')) {
          scheduleTargetReveal(target);
        } else {
          setTargetState(target, TARGET_STATE.ACTIVE);
        }
        return;
      }

      setTargetState(target, animateOnPaint ? TARGET_STATE.BEFORE : initialState);

      targetObserver.observe(target);
      target.classList.add('is-motion-prepared');

      if (animateOnPaint) scheduleTargetReveal(target);
    }

    function registerScene(scene) {
      if (runtimeDisposed || isReducedMotion || scenes.has(scene)) return;
      scenes.add(scene);
      sceneObserver.observe(scene);
    }

    function registerHero(hero) {
      if (runtimeDisposed || isReducedMotion || heroes.has(hero)) return;
      heroes.add(hero);
      heroObserver.observe(hero);
      resizeObserver?.observe(hero);
    }

    function unregisterTarget(target) {
      if (!targets.delete(target)) return;
      targetObserver.unobserve(target);
      activatedTargets.delete(target);
      endPromotedTargets.delete(target);
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
      if (runtimeDisposed) return;

      const atDocumentEnd = hasReachedDocumentEnd();
      const detachedTargets = [];
      const stateUpdates = [];

      targets.forEach((target) => {
        if (!target.isConnected) {
          detachedTargets.push(target);
          return;
        }

        if (target.classList.contains('is-motion-pending')) return;

        const rect = target.getBoundingClientRect();
        stateUpdates.push([target, resolveTargetState(target, rect, atDocumentEnd)]);
      });

      detachedTargets.forEach(unregisterTarget);
      stateUpdates.forEach(([target, state]) => setTargetState(target, state));
    }

    function runTargetReconciliation(timestamp) {
      targetFrame = undefined;
      if (runtimeDisposed) return;

      const shouldReconcile = forceTargetReconciliation
        || timestamp - lastTargetReconciliation >= LIVE_RECONCILIATION_INTERVAL;
      forceTargetReconciliation = false;
      if (!shouldReconcile) return;

      lastTargetReconciliation = timestamp;
      reconcileTargets();
    }

    function requestTargetReconciliation(force = false) {
      if (runtimeDisposed || isReducedMotion) return;
      forceTargetReconciliation ||= force;
      if (targetFrame !== undefined) return;
      targetFrame = requestAnimationFrame(runTargetReconciliation);
    }

    function handleViewportChange() {
      requestHeroUpdate();
      requestTargetReconciliation();
      if (reconciliationTimer !== undefined) window.clearTimeout(reconciliationTimer);
      reconciliationTimer = window.setTimeout(() => {
        reconciliationTimer = undefined;
        requestTargetReconciliation(true);
      }, 90);
    }

    function handlePageShow() {
      requestHeroUpdate();
      requestTargetReconciliation(true);
    }

    function handleVisibilityChange() {
      if (!document.hidden) handlePageShow();
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
        window.removeEventListener('pageshow', handlePageShow);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }

      if (heroFrame !== undefined) cancelAnimationFrame(heroFrame);
      if (targetFrame !== undefined) cancelAnimationFrame(targetFrame);
      if (reconciliationTimer !== undefined) window.clearTimeout(reconciliationTimer);
      forceTargetReconciliation = false;
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
      const observerTopInset = Math.round(window.innerHeight * exitBoundary);
      const observerBottomInset = Math.round(window.innerHeight * (1 - entranceBoundary));

      targetObserver = new IntersectionObserver((entries) => {
        if (runtimeDisposed) return;

        if (entries.some((entry) => !entry.target.classList.contains('is-motion-pending'))) {
          requestTargetReconciliation(true);
        }
      }, {
        rootMargin: `-${observerTopInset}px 0px -${observerBottomInset}px 0px`,
        threshold: 0
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
        : new ResizeObserver(() => {
          requestHeroUpdate();
          requestTargetReconciliation(true);
        });

      if (!isReducedMotion) resizeObserver?.observe(observedRoot);

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
          requestTargetReconciliation(true);
        });
        mutationObserver.observe(observedRoot, { childList: true, subtree: true });
      }

      if (!isReducedMotion) {
        window.addEventListener('scroll', handleViewportChange, { passive: true });
        window.addEventListener('resize', handleViewportChange, { passive: true });
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        listenersAttached = true;
      }

      document.documentElement.classList.add(READY_CLASS);
      heroes.forEach(updateHero);
      if (!isReducedMotion) requestTargetReconciliation(true);

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
