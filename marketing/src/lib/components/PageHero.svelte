<script>
  export let eyebrow = '';
  export let title = '';
  export let description = '';
</script>

<section class="page-hero" data-motion-scene="page-hero" data-motion-hero>
  <div class="page-hero__orb page-hero__orb--one"></div>
  <div class="page-hero__orb page-hero__orb--two"></div>
  <div class="site-container relative z-10 py-12 text-center sm:py-14 lg:py-16" data-motion-hero-copy>
    {#if eyebrow}
      <p class="eyebrow mx-auto mb-4 w-fit text-blue-100" data-motion="down" data-motion-intro data-motion-order="0">{eyebrow}</p>
    {/if}
    <h1 class="mx-auto max-w-4xl text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl" data-motion="rise" data-motion-intro data-motion-order="1">{title}</h1>
    {#if description}
      <p class="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-blue-100/90 sm:text-lg" data-motion="rise" data-motion-intro data-motion-order="2">{description}</p>
    {/if}
  </div>
</section>
