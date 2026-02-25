<script>
  import StripeReturnBridgePage from '$lib/components/StripeReturnBridgePage.svelte';
</script>

<svelte:head>
  <title>Pago completado | CAF</title>
  <meta
    name="description"
    content="Regresando a la aplicación CAF Cliente después de completar un pago en Stripe Checkout."
  />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<StripeReturnBridgePage
  status="success"
  badge="Stripe Checkout"
  icon="✓"
  title="Pago recibido"
  subtitle="Estamos regresándote a CAF Cliente para confirmar el pago y mostrar tus recibos."
/>

