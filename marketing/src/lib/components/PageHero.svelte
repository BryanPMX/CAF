<script>
  export let eyebrow = '';
  export let title = '';
  export let description = '';
</script>

<section class="page-hero">
  <div class="page-hero__orb page-hero__orb--one"></div>
  <div class="page-hero__orb page-hero__orb--two"></div>
  <div class="site-container relative z-10 py-12 text-center sm:py-14 lg:py-16">
    {#if eyebrow}
      <p class="eyebrow mx-auto mb-4 w-fit text-blue-100" data-aos="fade-down">{eyebrow}</p>
    {/if}
    <h1 class="mx-auto max-w-4xl text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl" data-aos="fade-up" data-aos-delay="80">{title}</h1>
    {#if description}
      <p class="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-blue-100/90 sm:text-lg" data-aos="fade-up" data-aos-delay="160">{description}</p>
    {/if}
  </div>
</section>
