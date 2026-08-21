<script>
  import { Mail, MapPin, Send, ShieldCheck } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import PageHero from '$lib/components/PageHero.svelte';
  import OfficeMap from '$lib/components/OfficeMap.svelte';
  import { formValidator, commonRules } from '$lib/utils/formValidator.js';
  import { apiUtils } from '$lib/utils/apiClient.js';
  import { loadTurnstileScript, resetTurnstileWidget } from '$lib/utils/turnstileClient.js';
  import { errorHandler } from '$lib/utils/errorHandler.js';
  import { config } from '$lib/config.js';

  let formData = { name: '', email: '', phone: '', message: '', officeId: '' };
  let isSubmitting = false;
  let formErrors = {};
  let offices = [];
  let loadingOffices = true;
  let turnstileContainer;
  let turnstileWidgetId = null;
  let turnstileToken = '';
  let turnstileError = '';
  const turnstileSiteKey = config?.security?.turnstileSiteKey || '';

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

  onMount(() => {
    let disposed = false;

    async function initializeTurnstile() {
      if (!turnstileSiteKey) {
        console.warn('VITE_TURNSTILE_SITE_KEY is not configured');
        return;
      }

      try {
        const turnstile = await loadTurnstileScript();
        if (!turnstile || !turnstileContainer || disposed) return;

        turnstileWidgetId = turnstile.render(turnstileContainer, {
          sitekey: turnstileSiteKey,
          theme: 'light',
          callback: (token) => {
            turnstileToken = token;
            turnstileError = '';
          },
          'expired-callback': () => {
            turnstileToken = '';
            turnstileError = 'La verificación expiró. Vuelve a intentarlo.';
          },
          'error-callback': () => {
            turnstileToken = '';
            turnstileError = 'No se pudo completar la verificación. Intenta nuevamente.';
          }
        });
      } catch (error) {
        console.error('Turnstile init failed:', error);
        turnstileError = 'No se pudo cargar la verificación de seguridad.';
      }
    }

    initializeTurnstile();

    return () => {
      disposed = true;
    };
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

    if (!turnstileSiteKey) {
      errorHandler.showNotification('Captcha no configurado. Contacte al administrador del sitio.', 'error');
      return;
    }

    if (!turnstileToken) {
      turnstileError = 'Completa la verificación de seguridad antes de enviar.';
      return;
    }

    isSubmitting = true;
    try {
      const success = await apiUtils.submitContactForm(formData, turnstileToken);
      if (success) {
        formData = { name: '', email: '', phone: '', message: '', officeId: '' };
        formErrors = {};
      }
    } catch (error) {
      errorHandler.handleError(error, 'contact_form_submission');
    } finally {
      isSubmitting = false;
      turnstileToken = '';
      resetTurnstileWidget(turnstileWidgetId);
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

<PageHero eyebrow="Estamos para escucharte" title="Dar el primer paso puede ser más sencillo" description="Encuentra la oficina más cercana o envíanos un mensaje. Nuestro equipo te orientará con respeto y confidencialidad." />

<section class="section-shell section-soft">
  <div class="site-container">
    <div class="grid gap-7 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
      <div data-aos="fade-right">
        <p class="eyebrow mb-4"><MapPin size={14} /> Ubicaciones</p>
        <h2 class="mb-5 text-3xl font-extrabold tracking-[-0.03em] text-primary-950">Encuentra tu oficina CAF</h2>
        <div class="surface-card overflow-hidden rounded-2xl">
          <OfficeMap offices={offices} loadingOffices={loadingOffices} defaultZoom={12} />
        </div>
      </div>

      <div data-aos="fade-left" data-aos-delay="90">
        <p class="eyebrow mb-4"><Mail size={14} /> Mensaje directo</p>
        <h2 class="mb-5 text-3xl font-extrabold tracking-[-0.03em] text-primary-950">Cuéntanos cómo podemos ayudarte</h2>
        <form id="form" class="surface-card space-y-4 rounded-2xl p-6" on:submit={handleSubmit}>
          <div>
            <label for="officeId" class="block text-sm font-medium text-slate-700 mb-1">Oficina</label>
            <select
              id="officeId"
              bind:value={formData.officeId}
              on:change={(e) => handleFieldChange('officeId', e.target.value)}
              required
              disabled={isSubmitting || loadingOffices}
              class="w-full"
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
          <div>
            <p class="mb-1 block text-sm font-medium text-slate-700">Verificación de seguridad</p>
            {#if turnstileSiteKey}
              <div class="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div bind:this={turnstileContainer}></div>
              </div>
              {#if turnstileError}
                <p class="mt-1 text-xs text-red-600">{turnstileError}</p>
              {/if}
            {:else}
              <p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                El formulario no está disponible temporalmente. Puedes escribirnos directamente a {config.contact.email}.
              </p>
            {/if}
          </div>
          <button
            type="submit"
            class="button-primary flex w-full border-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || !turnstileSiteKey}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar mensaje'} <Send size={18} />
          </button>
        </form>
      </div>
    </div>

    <div class="mt-12">
      <div class="mx-auto mb-7 max-w-2xl text-center" data-aos="fade-up">
        <p class="eyebrow mb-4">Directorio</p>
        <h2 class="text-3xl font-extrabold tracking-[-0.03em] text-primary-950">Todas nuestras oficinas</h2>
      </div>
      {#if loadingOffices}
        <div class="text-center py-10 text-slate-500">Cargando directorio...</div>
      {:else if offices.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each offices as office, i}
            <div
              class="card-lift rounded-2xl p-5"
              data-aos="fade-up"
              data-aos-delay={String(Math.min(i * 60, 180))}
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
                    <a href="tel:{office.phoneOffice}" class="touch-target inline-flex items-center rounded-lg px-1 text-primary-600 hover:text-primary-700">{office.phoneOffice}</a>
                  </div>
                {/if}
                {#if office.phoneCell}
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href="tel:{office.phoneCell}" class="touch-target inline-flex items-center rounded-lg px-1 text-primary-600 hover:text-primary-700">{office.phoneCell}</a>
                  </div>
                {/if}
              </div>
              {#if office.latitude && office.longitude}
                <div class="mt-4 pt-3 border-t border-white/40">
                  <a
                    href="https://www.google.com/maps?q={office.latitude},{office.longitude}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="touch-target inline-flex items-center gap-1 rounded-lg px-1 text-xs font-medium text-primary-600 hover:text-primary-700"
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

    <div class="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2">
      <a href="mailto:{config.contact.email}" class="card-lift rounded-2xl p-5 text-center" data-aos="fade-right">
        <Mail class="mx-auto text-primary-600" size={26} />
        <span class="mt-4 block text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Correo oficial</span>
        <span class="mt-2 block break-all text-sm font-bold text-primary-700">{config.contact.email}</span>
      </a>
      <div class="surface-card rounded-2xl p-5 text-center" data-aos="fade-left" data-aos-delay="80">
        <ShieldCheck class="mx-auto text-accent-600" size={26} />
        <span class="mt-4 block text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Privacidad</span>
        <span class="mt-2 block text-sm font-bold text-primary-950">Atención respetuosa y confidencial</span>
      </div>
    </div>
  </div>
</section>
