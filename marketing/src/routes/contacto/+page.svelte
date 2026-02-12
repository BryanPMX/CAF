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

<section class="hero-wave-scene relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-[#8d6bf7] py-16 text-white md:py-24">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.22),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(221,191,255,0.32),transparent_38%)]"></div>
  <div class="container relative z-10 mx-auto px-6 text-center">
    <h1 class="mb-4 text-4xl font-extrabold leading-tight md:text-5xl" in:fade={{ duration: 800, easing: cubicOut }}>
      Contáctanos
    </h1>
    <p class="mx-auto max-w-3xl text-lg text-primary-100 md:text-xl" in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
      Estamos aquí para escucharte. Encuentra la oficina más cercana o envíanos un mensaje.
    </p>
  </div>
  <div class="hero-wave-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 220" preserveAspectRatio="none" class="hero-wave-svg hero-wave-back h-28 w-full md:h-40 lg:h-44">
      <path class="hero-wave-path-back" d="M0,128L60,138.7C120,149,240,171,360,170.7C480,171,600,149,720,133.3C840,117,960,107,1080,112C1200,117,1320,139,1380,149.3L1440,160L1440,220L0,220Z"></path>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 220" preserveAspectRatio="none" class="hero-wave-svg hero-wave-front w-full h-24 md:h-36 lg:h-40">
      <path class="hero-wave-path-front" d="M0,128L60,138.7C120,149,240,171,360,170.7C480,171,600,149,720,133.3C840,117,960,107,1080,112C1200,117,1320,139,1380,149.3L1440,160L1440,220L0,220Z"></path>
    </svg>
  </div>
</section>

<section class="py-16 bg-[radial-gradient(circle_at_15%_15%,rgba(141,107,247,0.18),transparent_35%),radial-gradient(circle_at_86%_14%,rgba(56,120,214,0.16),transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8f1ff_52%,#edf6ff_100%)]">
  <div class="container mx-auto px-6">
    <div class="grid lg:grid-cols-2 gap-10">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-4">Nuestras Oficinas</h2>
        <div class="card-lift rounded-xl overflow-hidden">
          <OfficeMap defaultZoom={12} />
        </div>
      </div>

      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-4">Envíanos un Mensaje</h2>
        <form id="form" class="space-y-5 rounded-2xl border border-violet-100/90 bg-white/85 p-8 shadow-[0_12px_30px_rgba(41,67,120,0.1)]" on:submit={handleSubmit}>
          <div>
            <label for="officeId" class="block text-sm font-medium text-slate-700 mb-1">Oficina</label>
            <select
              id="officeId"
              bind:value={formData.officeId}
              on:change={(e) => handleFieldChange('officeId', e.target.value)}
              required
              disabled={isSubmitting || loadingOffices}
              class="focus:ring-primary-500 focus:border-primary-500 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm bg-white/70"
            >
              <option value="">Seleccione una oficina</option>
              {#each offices as office}
                <option value={String(office.id)}>{office.name}</option>
              {/each}
            </select>
            {#if loadingOffices}
              <p class="text-xs text-slate-500 mt-1">Cargando oficinas...</p>
            {/if}
          </div>
          <div>
            <label for="name" class="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
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
            <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
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
            <label for="phone" class="block text-sm font-medium text-slate-700 mb-1">Teléfono (Opcional)</label>
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
            <label for="message" class="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
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

    <div class="mt-16">
      <h2 class="text-2xl font-bold text-slate-900 mb-6 text-center">Directorio de Oficinas</h2>
      {#if loadingOffices}
        <div class="text-center py-10 text-slate-500">Cargando directorio...</div>
      {:else if offices.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each offices as office, i}
            <div
              class="rounded-xl p-6 card-lift"
              in:slide={{ duration: 500, delay: i * 80, easing: cubicOut }}
            >
              <div class="flex items-start gap-3 mb-4">
                <div class="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-slate-900">{office.name}</h3>
              </div>
              <div class="space-y-2 text-sm text-slate-600">
                {#if office.address}
                  <div class="flex items-start gap-2">
                    <svg class="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{office.address}</span>
                  </div>
                {/if}
                {#if office.phoneOffice}
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href="tel:{office.phoneOffice}" class="text-primary-600 hover:text-primary-700">{office.phoneOffice}</a>
                  </div>
                {/if}
                {#if office.phoneCell}
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href="tel:{office.phoneCell}" class="text-primary-600 hover:text-primary-700">{office.phoneCell}</a>
                  </div>
                {/if}
              </div>
              {#if office.latitude && office.longitude}
                <div class="mt-4 pt-3 border-t border-white/40">
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
          <p class="text-slate-500">No hay oficinas registradas.</p>
        </div>
      {/if}
    </div>

    <div class="mt-14 max-w-3xl mx-auto">
      <div class="relative overflow-hidden rounded-3xl border border-white/65 bg-[linear-gradient(140deg,rgba(255,255,255,0.72),rgba(246,241,255,0.62),rgba(239,247,255,0.68))] p-[1px] shadow-[0_18px_38px_rgba(34,63,112,0.12)]">
        <div class="pointer-events-none absolute -left-10 top-8 h-24 w-40 rounded-full bg-primary-200/55 blur-3xl"></div>
        <div class="pointer-events-none absolute -right-8 bottom-8 h-24 w-44 rounded-full bg-[#d5beff]/55 blur-3xl"></div>

        <div class="relative rounded-[1.45rem] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(246,241,255,0.86),rgba(239,247,255,0.88))] p-7 sm:p-9">
          <div class="text-center">
            <span class="inline-flex items-center rounded-full border border-primary-100 bg-white/75 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.17em] text-primary-700">Canales Oficiales</span>
            <h3 class="mt-3 text-2xl font-extrabold text-slate-900">Información General</h3>
            <p class="mt-1 text-sm text-slate-500">Respuestas rápidas para contacto y atención.</p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-white/70 bg-white/78 px-4 py-4 text-left shadow-[0_8px_16px_rgba(49,79,131,0.08)]">
              <div class="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Correo</div>
              <a href="mailto:{config.contact.email}" class="text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800">{config.contact.email}</a>
            </div>

            <div class="rounded-2xl border border-white/70 bg-white/78 px-4 py-4 text-left shadow-[0_8px_16px_rgba(49,79,131,0.08)]">
              <div class="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div class="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Teléfono</div>
              <a href="tel:{config.contact.phone}" class="text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800">{config.contact.phone}</a>
            </div>

            <div class="rounded-2xl border border-white/70 bg-white/78 px-4 py-4 text-left shadow-[0_8px_16px_rgba(49,79,131,0.08)]">
              <div class="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Horario</div>
              <span class="text-sm font-semibold text-slate-700">Lun-Vie: 8AM-6PM</span>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-white/70 bg-white/78 px-4 py-4 text-left shadow-[0_8px_16px_rgba(49,79,131,0.08)]">
            <div class="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Dirección General</div>
            <p class="text-sm font-medium text-slate-700">{config.contact.address}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
