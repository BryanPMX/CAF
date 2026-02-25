<script>
  import StripeReturnBridgePage from '$lib/components/StripeReturnBridgePage.svelte';
</script>

<svelte:head>
  <title>Pago cancelado | CAF</title>
  <meta
    name="description"
    content="Regresando a la aplicación CAF Cliente después de cancelar un pago en Stripe Checkout."
  />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<StripeReturnBridgePage
  status="cancel"
  badge="Stripe Checkout"
  icon="↺"
  title="Pago cancelado"
  subtitle="No se realizó ningún cargo. Te regresamos a CAF Cliente para continuar con el seguimiento de tu caso."
/>

