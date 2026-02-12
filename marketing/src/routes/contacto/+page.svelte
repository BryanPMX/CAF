<script>
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import OfficeMap from '$lib/components/OfficeMap.svelte';
  import { formValidator, commonRules } from '$lib/utils/formValidator.js';
  import { apiUtils } from '$lib/utils/apiClient.js';
  import { errorHandler } from '$lib/utils/errorHandler.js';
  import { config } from '$lib/config.js';

  let formData = { name: '', email: '', phone: '', message: '', officeId: '' };
  let isSubmitting = false;
  let formErrors = {};
  let offices = [];
  let loadingOffices = true;

  onMount(async () => {
    try {
      const data = await apiUtils.fetchOffices();
      offices = data || [];
    } catch (err) {
      console.warn('Failed to load offices:', err);
    } finally {
      loadingOffices = false;
    }
  });

  async function handleSubmit(event) {
    event.preventDefault();
    formErrors = {};
    formValidator.clearFieldErrors(document.getElementById('form'));

    const validation = formValidator.validateForm(formData, commonRules.contactForm);
    if (!validation.isValid) {
      formErrors = validation.errors;
      showFieldErrors();
      return;
    }

    isSubmitting = true;
    try {
      const success = await apiUtils.submitContactForm(formData);
      if (success) {
        formData = { name: '', email: '', phone: '', message: '', officeId: '' };
        formErrors = {};
      }
    } catch (error) {
      errorHandler.handleError(error, 'contact_form_submission');
    } finally {
      isSubmitting = false;
    }
  }

  function showFieldErrors() {
    Object.keys(formErrors).forEach(fieldName => {
      const field = document.getElementById(fieldName);
      const container = field?.parentElement;
      if (container) {
        formValidator.showFieldErrors(fieldName, formErrors[fieldName], container);
        formValidator.addErrorStyling(field);
      }
    });
  }

  function handleFieldChange(fieldName, value) {
    formData[fieldName] = value;
    if (formErrors[fieldName]) {
      delete formErrors[fieldName];
      const field = document.getElementById(fieldName);
      const container = field?.parentElement;
      if (container) {
        formValidator.clearFieldErrors(container);
        formValidator.removeErrorStyling(field);
      }
    }
  }
</script>

<svelte:head>
  <title>Contacto y Ubicaciones - Centro de Apoyo para la Familia A.C.</title>
  <meta name="description" content="Encuentre nuestras oficinas y póngase en contacto con nosotros." />
</svelte:head>

<!-- Page Header -->
<section class="relative bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 text-white overflow-hidden py-16 md:py-20">
  <div class="container mx-auto px-6 relative z-10 text-center">
    <h1 class="text-4xl md:text-5xl font-extrabold leading-tight mb-4" in:fade={{ duration: 800, easing: cubicOut }}>
      Contáctanos
    </h1>
    <p class="text-lg md:text-xl text-primary-100 max-w-3xl mx-auto" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
      Estamos aquí para escucharte. Encuentra la oficina más cercana o envíanos un mensaje.
    </p>
  </div>
  <div class="absolute bottom-0 left-0 w-full leading-[0]">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" preserveAspectRatio="none" class="w-full h-16 md:h-24">
      <path fill="#f9fafb" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L0,120Z"></path>
    </svg>
  </div>
</section>

<!-- Contact Info + Map + Directory -->
<section class="py-16 bg-gray-50">
  <div class="container mx-auto px-6">
    <!-- Map and Form side by side -->
    <div class="grid lg:grid-cols-2 gap-10">
      <!-- Left: Map -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Nuestras Oficinas</h2>
        <div class="rounded-xl overflow-hidden shadow-md border border-gray-200">
          <OfficeMap defaultZoom={12} />
        </div>
      </div>

      <!-- Right: Contact Form -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Envíanos un Mensaje</h2>
        <form id="form" class="space-y-5 bg-white p-8 rounded-xl shadow-sm border border-gray-100" on:submit={handleSubmit}>
          <div>
            <label for="officeId" class="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
            <select
              id="officeId"
              bind:value={formData.officeId}
              on:change={(e) => handleFieldChange('officeId', e.target.value)}
              required
              disabled={isSubmitting || loadingOffices}
              class="focus:ring-primary-500 focus:border-primary-500 w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm"
            >
              <option value="">Seleccione una oficina</option>
              {#each offices as office}
                <option value={office.id}>{office.name}</option>
              {/each}
            </select>
            {#if loadingOffices}
              <p class="text-xs text-gray-500 mt-1">Cargando oficinas...</p>
            {/if}
          </div>
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input
              type="text" id="name"
              bind:value={formData.name}
              on:input={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Ingresa tu nombre completo"
              required disabled={isSubmitting}
              class="focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input
              type="email" id="email"
              bind:value={formData.email}
              on:input={(e) => handleFieldChange('email', e.target.value)}
              placeholder="correo@ejemplo.com"
              required disabled={isSubmitting}
              class="focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)</label>
            <input
              type="tel" id="phone"
              bind:value={formData.phone}
              on:input={(e) => handleFieldChange('phone', e.target.value)}
              placeholder="(###) ###-####"
              disabled={isSubmitting}
              class="focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label for="message" class="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
            <textarea
              id="message" rows="4"
              bind:value={formData.message}
              on:input={(e) => handleFieldChange('message', e.target.value)}
              placeholder="Escribe tu mensaje aquí"
              required disabled={isSubmitting}
              class="focus:ring-primary-500 focus:border-primary-500"
            ></textarea>
          </div>
          <button
            type="submit"
            class="w-full bg-gradient-to-r from-primary-600 to-accent-600 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
        </form>
      </div>
    </div>

    <!-- Office Directory -->
    <div class="mt-16">
      <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Directorio de Oficinas</h2>
      {#if loadingOffices}
        <div class="text-center py-10 text-gray-500">Cargando directorio...</div>
      {:else if offices.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each offices as office, i}
            <div
              class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 card-lift"
              in:slide={{ duration: 500, delay: i * 80, easing: cubicOut }}
            >
              <div class="flex items-start gap-3 mb-4">
                <div class="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900">{office.name}</h3>
              </div>
              <div class="space-y-2 text-sm text-gray-600">
                {#if office.address}
                  <div class="flex items-start gap-2">
                    <svg class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{office.address}</span>
                  </div>
                {/if}
                {#if office.phoneOffice}
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href="tel:{office.phoneOffice}" class="text-primary-600 hover:text-primary-700">{office.phoneOffice}</a>
                  </div>
                {/if}
                {#if office.phoneCell}
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href="tel:{office.phoneCell}" class="text-primary-600 hover:text-primary-700">{office.phoneCell}</a>
                  </div>
                {/if}
              </div>
              {#if office.latitude && office.longitude}
                <div class="mt-4 pt-3 border-t border-gray-100">
                  <a
                    href="https://www.google.com/maps?q={office.latitude},{office.longitude}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    Ver en Google Maps
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-10">
          <p class="text-gray-500">No hay oficinas registradas.</p>
        </div>
      {/if}
    </div>

    <!-- General Contact Info -->
    <div class="mt-12 bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-2xl mx-auto text-center">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Información General</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
        <div>
          <div class="text-gray-400 mb-1">Correo</div>
          <a href="mailto:{config.contact.email}" class="text-primary-600 font-medium">{config.contact.email}</a>
        </div>
        <div>
          <div class="text-gray-400 mb-1">Teléfono</div>
          <a href="tel:{config.contact.phone}" class="text-primary-600 font-medium">{config.contact.phone}</a>
        </div>
        <div>
          <div class="text-gray-400 mb-1">Horario</div>
          <span class="text-gray-700">Lun-Vie: 8AM-6PM</span>
        </div>
      </div>
    </div>
  </div>
</section>
