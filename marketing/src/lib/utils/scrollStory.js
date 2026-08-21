let enginePromise;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function loadScrollEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger')
    ]).then(([gsapModule, scrollTriggerModule]) => {
      const gsap = gsapModule.gsap ?? gsapModule.default;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger ?? scrollTriggerModule.default;
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    });
  }

  return enginePromise;
}

/**
 * Creates the curated Inicio scroll narrative and returns a cleanup function.
 * Each scene owns its animation so route changes can revert every inline style.
 */
export async function initializeScrollStory(root = document) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return () => {};

  const story = root.querySelector('[data-scroll-story]');
  if (!story) return () => {};

  const { gsap, ScrollTrigger } = await loadScrollEngine();
  let media;

  const context = gsap.context(() => {
    media = gsap.matchMedia();
    media.add(
      {
        desktop: '(min-width: 768px)',
        mobile: '(max-width: 767px)'
      },
      ({ conditions }) => {
        const isDesktop = conditions.desktop;
        const scrub = isDesktop ? 0.8 : 0.45;
        const entranceStart = isDesktop ? 'top 88%' : 'top 92%';
        const entranceEnd = isDesktop ? 'top 30%' : 'top 48%';
        const exitBlur = isDesktop ? 'blur(8px)' : 'blur(0px)';

        const hero = story.querySelector('[data-scroll-scene="hero"]');
        const heroCopy = hero?.querySelector('[data-story-role="hero-copy"]');
        const heroVisual = hero?.querySelector('[data-story-role="hero-visual"]');
        const heroCue = hero?.querySelector('[data-story-role="hero-cue"]');

        if (hero && heroCopy && heroVisual) {
          gsap.timeline({
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: isDesktop ? 'bottom 24%' : 'bottom 38%',
              scrub
            }
          })
            .to(heroCopy, {
              y: isDesktop ? -96 : -54,
              scale: 0.96,
              autoAlpha: 0.06,
              filter: exitBlur,
              ease: 'none'
            }, 0)
            .to(heroVisual, {
              y: isDesktop ? 100 : 58,
              scale: isDesktop ? 0.88 : 0.94,
              autoAlpha: 0.34,
              filter: isDesktop ? 'blur(4px)' : 'blur(0px)',
              ease: 'none'
            }, 0)
            .to(heroCue, {
              y: 22,
              autoAlpha: 0,
              ease: 'none'
            }, 0);
        }

        const bridge = story.querySelector('[data-scroll-scene="bridge"]');
        const bridgeItems = bridge?.querySelectorAll('[data-story-role="bridge-item"]');
        if (bridge && bridgeItems?.length) {
          gsap.fromTo(bridgeItems,
            { y: 22, autoAlpha: 0.18 },
            {
              y: 0,
              autoAlpha: 1,
              stagger: 0.08,
              ease: 'none',
              scrollTrigger: {
                trigger: bridge,
                start: 'top 98%',
                end: 'top 78%',
                scrub: 0.35
              }
            }
          );
        }

        const narrativeScenes = story.querySelectorAll('.section-shell[data-scroll-scene]');
        narrativeScenes.forEach((scene) => {
          gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: 'top 100%',
              end: 'top 38%',
              scrub: isDesktop ? 0.7 : 0.4
            }
          })
            .fromTo(scene,
              { '--story-sweep-x': '-22%', '--story-sweep-opacity': 0 },
              { '--story-sweep-x': '0%', '--story-sweep-opacity': 0.95, ease: 'none', duration: 0.48 }
            )
            .to(scene,
              { '--story-sweep-x': '22%', '--story-sweep-opacity': 0, ease: 'none', duration: 0.52 }
            );
        });

        const about = story.querySelector('[data-scroll-scene="about"]');
        const aboutVisual = about?.querySelector('[data-story-role="about-visual"]');
        const aboutCopy = about?.querySelector('[data-story-role="about-copy"]');
        if (about && aboutVisual && aboutCopy) {
          gsap.fromTo(aboutVisual,
            { x: isDesktop ? -130 : -38, rotate: isDesktop ? -3 : -1, scale: 0.9, autoAlpha: 0, filter: isDesktop ? 'blur(7px)' : 'blur(0px)' },
            { x: 0, rotate: 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: about, start: entranceStart, end: entranceEnd, scrub } }
          );
          gsap.fromTo(aboutCopy,
            { x: isDesktop ? 130 : 38, y: 24, autoAlpha: 0, filter: isDesktop ? 'blur(7px)' : 'blur(0px)' },
            { x: 0, y: 0, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: about, start: entranceStart, end: entranceEnd, scrub } }
          );
          gsap.to([aboutVisual, aboutCopy], {
            y: isDesktop ? -48 : -28,
            autoAlpha: 0.12,
            filter: exitBlur,
            ease: 'none',
            scrollTrigger: { trigger: about, start: 'bottom 72%', end: 'bottom 18%', scrub }
          });
        }

        const services = story.querySelector('[data-scroll-scene="services"]');
        const servicesHeading = services?.querySelectorAll('[data-story-role="services-heading"]');
        const serviceCards = services?.querySelectorAll('[data-story-role="service-card"]');
        if (services && serviceCards?.length) {
          gsap.fromTo(servicesHeading,
            { y: 62, autoAlpha: 0, filter: isDesktop ? 'blur(6px)' : 'blur(0px)' },
            { y: 0, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: services, start: entranceStart, end: 'top 48%', scrub } }
          );
          gsap.fromTo(serviceCards,
            { y: isDesktop ? 145 : 80, rotateX: isDesktop ? 9 : 0, scale: 0.92, autoAlpha: 0 },
            { y: 0, rotateX: 0, scale: 1, autoAlpha: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: services, start: 'top 74%', end: 'top 20%', scrub } }
          );
          gsap.to(serviceCards, {
            x: (index) => isDesktop ? (index - 1) * 105 : 0,
            y: -42,
            autoAlpha: 0.1,
            filter: exitBlur,
            stagger: 0.04,
            ease: 'none',
            scrollTrigger: { trigger: services, start: 'bottom 72%', end: 'bottom 16%', scrub }
          });
        }

        const process = story.querySelector('[data-scroll-scene="process"]');
        const processHeading = process?.querySelector('[data-story-role="process-heading"]');
        const processSteps = process?.querySelectorAll('[data-story-role="process-step"]');
        if (process && processHeading && processSteps?.length) {
          gsap.fromTo(processHeading,
            { scale: 0.9, y: 52, autoAlpha: 0, filter: isDesktop ? 'blur(8px)' : 'blur(0px)' },
            { scale: 1, y: 0, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: process, start: entranceStart, end: 'top 48%', scrub } }
          );
          gsap.fromTo(processSteps,
            { y: isDesktop ? 155 : 84, scale: 0.86, autoAlpha: 0 },
            { y: 0, scale: 1, autoAlpha: 1, stagger: 0.14, ease: 'none', scrollTrigger: { trigger: process, start: 'top 76%', end: 'top 18%', scrub } }
          );
          gsap.to([processHeading, ...processSteps], {
            y: -38,
            autoAlpha: 0.12,
            filter: exitBlur,
            stagger: 0.03,
            ease: 'none',
            scrollTrigger: { trigger: process, start: 'bottom 72%', end: 'bottom 16%', scrub }
          });
        }

        const community = story.querySelector('[data-scroll-scene="community"]');
        const communityCopy = community?.querySelector('[data-story-role="community-copy"]');
        const communityVisual = community?.querySelector('[data-story-role="community-visual"]');
        if (community && communityCopy && communityVisual) {
          gsap.fromTo(communityCopy,
            { x: isDesktop ? -105 : -36, y: 30, autoAlpha: 0 },
            { x: 0, y: 0, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: community, start: entranceStart, end: entranceEnd, scrub } }
          );
          gsap.fromTo(communityVisual,
            { x: isDesktop ? 90 : 28, scale: 0.94, autoAlpha: 0, clipPath: 'inset(0 100% 0 0 round 2rem)' },
            { x: 0, scale: 1, autoAlpha: 1, clipPath: 'inset(0 0% 0 0 round 2rem)', ease: 'none', scrollTrigger: { trigger: community, start: entranceStart, end: 'top 22%', scrub } }
          );
          gsap.to([communityCopy, communityVisual], {
            y: -42,
            autoAlpha: 0.12,
            filter: exitBlur,
            ease: 'none',
            scrollTrigger: { trigger: community, start: 'bottom 72%', end: 'bottom 18%', scrub }
          });
        }

        const cta = story.querySelector('[data-scroll-scene="cta"]');
        const ctaContent = cta?.querySelector('[data-story-role="cta-content"]');
        const ctaRing = cta?.querySelector('[data-story-role="cta-ring"]');
        if (cta && ctaContent) {
          gsap.fromTo(ctaContent,
            { y: 90, scale: 0.88, autoAlpha: 0, filter: isDesktop ? 'blur(10px)' : 'blur(0px)' },
            { y: 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: cta, start: 'top 94%', end: 'top 40%', scrub } }
          );
          if (ctaRing) {
            gsap.fromTo(ctaRing,
              { rotate: -35, scale: 0.72, autoAlpha: 0.1 },
              { rotate: 24, scale: 1.15, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: cta, start: 'top 94%', end: 'top 18%', scrub } }
            );
          }
        }
      }
    );
  }, story);

  requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    media?.revert();
    context.revert();
  };
}
