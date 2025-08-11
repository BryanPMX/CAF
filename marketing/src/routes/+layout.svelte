<script>
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import '../app.css';
</script>

<div class="flex flex-col min-h-screen bg-gray-50 font-sans">
  <Header />

  <!-- The <slot /> is where the content of each individual page will be rendered -->
  <main class="flex-grow">
    <slot />
  </main>

  <Footer />
</div>