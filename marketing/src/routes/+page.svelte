<script>
  import {
    ArrowLeft, ArrowRight, CheckCircle2, Eye, HandHeart, HeartHandshake,
    MessageCircle, Scale, ShieldCheck, Sparkles, Target, UsersRound
  } from '@lucide/svelte';
  import { buildResponsiveSrcSet, getOptimizedImageUrl } from '$lib/utils/imageOptimizer.js';

  export let data;

  const content = data.content || {};
  const hero = content.hero || {};
  const about = content.about || {};
  const services = data.services || [];
  const heroSlides = data.images || [];
  const gallerySlides = data.galleryImages || [];
  const gallerySectionImages = data.gallerySectionImages || [];
  const aboutSectionImages = data.aboutSectionImages || [];
  const communityImages = gallerySectionImages.length > 0 ? gallerySectionImages : (gallerySlides.length > 0 ? gallerySlides : heroSlides);
  const serviceIcons = [Scale, HeartHandshake, UsersRound];
  const serviceTones = [
    'bg-primary-50 text-primary-700',
    'bg-warm-100 text-warm-600',
    'bg-accent-50 text-accent-700',
  ];
  const defaultServices = [
    { title: 'Asesoría legal', description: 'Orientación clara para comprender opciones, derechos y próximos pasos.' },
    { title: 'Apoyo psicológico', description: 'Un espacio de escucha profesional para fortalecer el bienestar emocional.' },
    { title: 'Asistencia social', description: 'Acompañamiento para identificar recursos y redes de apoyo disponibles.' },
  ];
  const processSteps = [
    { icon: MessageCircle, number: '01', title: 'Cuéntanos tu situación', copy: 'Comunícate con nuestro equipo por el medio que te resulte más cómodo.' },
    { icon: Scale, number: '02', title: 'Recibe orientación', copy: 'Escuchamos tus necesidades y te explicamos con claridad las opciones disponibles.' },
    { icon: HandHeart, number: '03', title: 'Avanza con acompañamiento', copy: 'Te conectamos con el servicio adecuado para continuar tu proceso.' },
  ];
  let currentCommunityImage = 0;

  function previousImage() {
    currentCommunityImage = (currentCommunityImage - 1 + communityImages.length) % communityImages.length;
  }

  function nextImage() {
    currentCommunityImage = (currentCommunityImage + 1) % communityImages.length;
  }
</script>

<svelte:head>
  <title>Centro de Apoyo para la Familia A.C. | Apoyo integral para familias</title>
  <meta name="description" content="Acompañamiento legal, psicológico y social para familias. Un espacio profesional, cercano y confidencial." />
</svelte:head>

<div class="motion-story" data-motion-root="inicio">
<section class="home-hero relative isolate overflow-hidden" data-motion-scene="hero" data-motion-hero>
  <div class="hero-atmosphere pointer-events-none absolute inset-0 z-0" aria-hidden="true">
    <span class="hero-gradient hero-gradient--blue"></span>
    <span class="hero-gradient hero-gradient--teal"></span>
    <span class="hero-gradient hero-gradient--warm"></span>
    <span class="hero-particle-field"></span>
  </div>
  <div class="site-container relative z-10 grid min-h-[clamp(34rem,68vh,43rem)] items-center gap-8 py-10 lg:grid-cols-[1.03fr_0.97fr] lg:gap-12 lg:py-12">
    <div class="max-w-2xl lg:text-center" data-motion-hero-copy>
      <p class="eyebrow hero-eyebrow mb-4 lg:mx-auto"><Sparkles size={14} /> Acompañamiento integral</p>
      <h1 class="text-balance text-[clamp(2.7rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.05em] text-white">
        {hero.title || 'Fortaleciendo familias, construyendo comunidad'}
      </h1>
      <p class="hero-copy mt-5 max-w-xl text-pretty text-lg leading-8 sm:text-xl lg:mx-auto">
        {hero.subtitle || 'Acompañamiento legal, psicológico y social con la cercanía que tu familia necesita.'}
      </p>
      <div class="mt-7 flex flex-col gap-3 sm:flex-row lg:justify-center">
        <a href="/contacto" class="button-primary inline-flex">Hablar con el equipo <ArrowRight size={18} /></a>
        <a href="/servicios" class="button-secondary inline-flex">Conocer los servicios</a>
      </div>
    </div>

    <div class="hero-visual relative lg:pl-4" data-motion-hero-visual>
      <div class="hero-media relative overflow-hidden rounded-[2rem] bg-primary-100 shadow-[0_32px_80px_rgba(3,15,29,0.38)] lg:rounded-[2.5rem]">
        {#if heroSlides[0]}
          <img
            src={getOptimizedImageUrl(heroSlides[0].src, 1280, { quality: 75 })}
            alt={heroSlides[0].alt || 'Familias acompañadas por CAF'}
            width="1280"
            height="1440"
            srcset={buildResponsiveSrcSet(heroSlides[0].src, [480, 768, 960, 1280], { quality: 75 }) || undefined}
            sizes="(max-width: 1024px) 100vw, 46vw"
            class="h-[27rem] w-full object-cover sm:h-[32rem] lg:h-[35rem]"
            decoding="async"
            fetchpriority="high"
          />
        {:else}
          <div class="flex h-[32rem] items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 text-primary-700">
            <HandHeart size={96} strokeWidth={1.2} />
          </div>
        {/if}
        <div class="absolute inset-0 bg-gradient-to-t from-primary-950/55 via-transparent to-transparent"></div>
        <div class="absolute bottom-4 left-4 right-4 rounded-xl border border-white/20 bg-white/92 p-3.5 shadow-lg backdrop-blur sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-[18rem]">
          <p class="flex items-center gap-2 text-sm font-extrabold text-primary-950"><CheckCircle2 class="text-accent-600" size={19} /> Un primer paso, a tu ritmo</p>
          <p class="mt-1 text-xs leading-5 text-slate-600">Escuchamos tu situación y te orientamos hacia el apoyo adecuado.</p>
        </div>
      </div>
      <div class="hero-visual-ring absolute -right-4 -top-4 -z-10 h-24 w-24 rounded-full border-[18px] sm:-right-7 sm:-top-7 sm:h-32 sm:w-32"></div>
    </div>
  </div>
</section>

<section class="home-trust-bar border-y py-4" data-motion-scene="bridge">
  <div class="site-container grid gap-5 text-center sm:grid-cols-3 sm:text-left">
    <div class="flex items-center justify-center gap-3 sm:justify-start" data-motion="rise" data-motion-order="0"><Scale class="text-primary-600" size={22} /><span class="text-sm font-bold">Orientación profesional</span></div>
    <div class="flex items-center justify-center gap-3 sm:justify-start" data-motion="rise" data-motion-order="1"><HeartHandshake class="text-warm-500" size={22} /><span class="text-sm font-bold">Trato cercano y respetuoso</span></div>
    <div class="flex items-center justify-center gap-3 sm:justify-start" data-motion="rise" data-motion-order="2"><ShieldCheck class="text-accent-600" size={22} /><span class="text-sm font-bold">Privacidad en cada consulta</span></div>
  </div>
</section>

<section class="section-shell section-soft" data-motion-scene="about">
  <div class="site-container grid items-center gap-9 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
    <div class="relative" data-motion="left" data-motion-exit="dissolve">
      {#if aboutSectionImages[0]}
        <div class="overflow-hidden rounded-[2rem] shadow-[0_24px_60px_rgba(21,50,78,0.16)]">
          <img
            src={getOptimizedImageUrl(aboutSectionImages[0].src, 960)}
            alt={aboutSectionImages[0].alt || 'Equipo de Centro de Apoyo para la Familia'}
            width="960" height="1080"
            srcset={buildResponsiveSrcSet(aboutSectionImages[0].src, [480, 720, 960]) || undefined}
            sizes="(max-width: 1024px) 100vw, 42vw"
            class="h-[27rem] w-full object-cover sm:h-[34rem]"
            loading="lazy" decoding="async"
          />
        </div>
      {:else}
        <div class="grid min-h-[18rem] place-items-center rounded-[2rem] bg-gradient-to-br from-primary-100 via-white to-accent-100 text-primary-700 shadow-[0_24px_60px_rgba(21,50,78,0.12)] sm:min-h-[22rem] lg:min-h-[24rem]">
          <HandHeart class="h-16 w-16 lg:h-[4.5rem] lg:w-[4.5rem]" strokeWidth={1.1} />
        </div>
      {/if}
      <div class="absolute -bottom-5 right-0 max-w-[14rem] rounded-2xl bg-warm-500 p-5 text-white shadow-xl xl:-right-7">
        <p class="text-sm font-extrabold leading-6">Cada familia merece sentirse escuchada, informada y acompañada.</p>
      </div>
    </div>

    <div data-motion="right" data-motion-exit="dissolve">
      <p class="eyebrow mb-4">Quiénes somos</p>
      <h2 class="section-title text-primary-950">{about.title || 'Un centro de apoyo pensado para las personas'}</h2>
      <p class="section-copy mt-4">{about.description || 'Somos una organización sin fines de lucro dedicada a fortalecer el núcleo familiar mediante servicios integrales.'}</p>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        {#if about.mission}
          <article class="surface-card rounded-2xl p-6">
            <Target class="text-primary-600" size={25} />
            <h3 class="mt-4 text-lg font-extrabold">Nuestra misión</h3>
            <p class="mt-2 text-sm leading-6 text-slate-600">{about.mission}</p>
          </article>
        {/if}
        {#if about.vision}
          <article class="surface-card rounded-2xl p-6">
            <Eye class="text-accent-600" size={25} />
            <h3 class="mt-4 text-lg font-extrabold">Nuestra visión</h3>
            <p class="mt-2 text-sm leading-6 text-slate-600">{about.vision}</p>
          </article>
        {/if}
      </div>
    </div>
  </div>
</section>

<section class="section-shell section-alive" data-motion-scene="services">
  <div class="site-container">
    <div class="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
      <div data-motion="left" data-motion-exit="dissolve">
        <p class="eyebrow mb-4">Atención especializada</p>
        <h2 class="section-title text-primary-950">Apoyo integral para distintos momentos de la vida familiar</h2>
      </div>
      <div class="lg:pb-1" data-motion="right" data-motion-exit="dissolve">
        <p class="section-copy max-w-xl lg:ml-auto">Unimos distintas áreas de atención para que no tengas que navegar una situación compleja sin orientación.</p>
      </div>
    </div>

    <div class="mt-8 grid gap-5 md:grid-cols-3">
      {#each services.length > 0 ? services : defaultServices as service, i}
        <article class="card-lift group flex flex-col rounded-2xl p-6" data-motion="rise" data-motion-order={i}>
          <div class="flex items-start justify-between gap-4">
            <span class="flex h-11 w-11 items-center justify-center rounded-xl {serviceTones[i % 3]}">
              <svelte:component this={serviceIcons[i % 3]} size={22} strokeWidth={1.9} />
            </span>
          </div>
          <h3 class="mt-5 text-xl font-extrabold tracking-[-0.025em] text-primary-950">{service.title}</h3>
          <p class="mt-3 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
          <a href="/servicios" class="touch-target mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-primary-700 transition-colors hover:text-primary-900" aria-label={`Conocer más sobre ${service.title}`}>
            Conocer más <ArrowRight class="transition-transform group-hover:translate-x-1" size={17} />
          </a>
        </article>
      {/each}
    </div>
  </div>
</section>

<section class="section-shell section-alive-alt" data-motion-scene="process">
  <div class="site-container">
    <div class="mx-auto max-w-2xl text-center" data-motion="scale" data-motion-exit="dissolve">
      <p class="eyebrow mb-4">Cómo comenzar</p>
      <h2 class="section-title text-primary-950">Un proceso claro, humano y sin presión</h2>
      <p class="section-copy mt-4">Dar el primer paso puede sentirse difícil. Por eso simplificamos el camino para pedir orientación.</p>
    </div>
    <ol class="relative mt-8 grid gap-5 md:grid-cols-3">
      {#each processSteps as step, i}
        <li class="surface-card relative rounded-2xl p-6" data-motion="rise" data-motion-order={i}>
          <span class="text-sm font-extrabold text-accent-700">{step.number}</span>
          <svelte:component this={step.icon} class="mt-5 text-primary-600" size={27} strokeWidth={1.9} />
          <h3 class="mt-4 text-xl font-extrabold text-primary-950">{step.title}</h3>
          <p class="mt-3 text-sm leading-7 text-slate-600">{step.copy}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

{#if communityImages.length > 0}
  <section class="section-shell section-alive" data-motion-scene="community">
    <div class="site-container grid items-center gap-10 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16">
      <div data-motion="left" data-motion-exit="dissolve">
        <p class="eyebrow mb-4">Nuestra comunidad</p>
        <h2 class="section-title text-primary-950">El apoyo también se construye juntos</h2>
        <p class="section-copy mt-4">Talleres, encuentros y actividades que crean vínculos y fortalecen a nuestra comunidad.</p>
        {#if communityImages.length > 1}
          <div class="mt-6 flex items-center gap-3">
            <button on:click={previousImage} class="touch-target inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-primary-950 transition hover:border-primary-300 hover:bg-primary-50" aria-label="Ver imagen anterior">
              <ArrowLeft size={20} />
            </button>
            <span class="min-w-[4rem] text-center text-sm font-extrabold tabular-nums text-slate-500">{currentCommunityImage + 1} / {communityImages.length}</span>
            <button on:click={nextImage} class="touch-target inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-primary-950 transition hover:border-primary-300 hover:bg-primary-50" aria-label="Ver siguiente imagen">
              <ArrowRight size={20} />
            </button>
          </div>
        {/if}
      </div>

      <div class="relative overflow-hidden rounded-[2rem] bg-slate-100 shadow-[0_24px_60px_rgba(21,50,78,0.16)]" role="region" aria-label="Galería de la comunidad" aria-live="polite" data-motion="right" data-motion-exit="dissolve">
        <img
          src={getOptimizedImageUrl(communityImages[currentCommunityImage].src, 1280, { quality: 72 })}
          alt={communityImages[currentCommunityImage].alt || 'Actividad de la comunidad CAF'}
          width="1280" height="800"
          srcset={buildResponsiveSrcSet(communityImages[currentCommunityImage].src, [480, 768, 960, 1280], { quality: 72 }) || undefined}
          sizes="(max-width: 1024px) 100vw, 62vw"
          class="h-[22rem] w-full object-cover sm:h-[31rem]"
          loading="lazy" decoding="async"
        />
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary-950/65 to-transparent px-6 pb-6 pt-20 text-sm font-bold text-white">
          Creando espacios de confianza, aprendizaje y conexión.
        </div>
      </div>
    </div>
  </section>
{/if}

<section class="cta-live bg-primary-950 py-12 text-white sm:py-14" data-motion-scene="cta">
  <div class="site-container relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary-800 to-accent-700 px-6 py-10 text-center sm:px-10 sm:py-12">
    <div class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[30px] border-white/10" data-motion="spin" data-motion-order="1"></div>
    <div class="relative mx-auto max-w-3xl" data-motion="scale">
      <p class="text-xs font-extrabold uppercase tracking-[0.16em] text-accent-100">Estamos para escucharte</p>
      <h2 class="mt-4 text-balance text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-5xl">No tienes que resolverlo todo por tu cuenta</h2>
      <p class="mx-auto mt-5 max-w-2xl text-base leading-8 text-blue-50/90 sm:text-lg">Conversemos sobre tu situación y encontremos juntos el apoyo más adecuado para ti y tu familia.</p>
      <a href="/contacto" class="button-light mt-8 inline-flex">Solicitar orientación <ArrowRight size={18} /></a>
    </div>
  </div>
</section>
</div>
