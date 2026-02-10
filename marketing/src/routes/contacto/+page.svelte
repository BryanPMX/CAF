<script>
    import { fade, slide } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { onMount } from 'svelte';
    import ContactInfo from '$lib/components/ContactInfo.svelte';
    import OfficeMap from '$lib/components/OfficeMap.svelte';
    import { formValidator, commonRules } from '$lib/utils/formValidator.js';
    import { apiUtils } from '$lib/utils/apiClient.js';
    import { errorHandler } from '$lib/utils/errorHandler.js';

    let formData = {
      name: '',
      email: '',
      phone: '',
      message: ''
    };

    let isSubmitting = false;
    let formErrors = {};

    // Handle form submission
    async function handleSubmit(event) {
      event.preventDefault();
      
      // Clear previous errors
      formErrors = {};
      formValidator.clearFieldErrors(document.getElementById('form'));
      
      // Validate form
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
          // Reset form
          formData = { name: '', email: '', phone: '', message: '' };
          formErrors = {};
        }
      } catch (error) {
        errorHandler.handleError(error, 'contact_form_submission');
      } finally {
        isSubmitting = false;
      }
    }

    // Show field errors
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

    // Handle field changes
    function handleFieldChange(fieldName, value) {
      formData[fieldName] = value;
      
      // Clear field errors when user starts typing
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

    // Optional: run API connectivity check only if you expose GET /health on the API (avoids 404 in console)
    // onMount(() => { apiUtils.checkConnectivity(); });
  </script>
  
  <svelte:head>
    <title>Contacto y Ubicaciones - Centro de Apoyo para la Familia A.C.</title>
    <meta name="description" content="Encuentre nuestras 5 oficinas en Ciudad Juárez. Póngase en contacto con nosotros por teléfono, correo electrónico o a través de nuestro formulario." />
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
  </svelte:head>
  
  <!-- Page Header -->
  <section class="relative bg-gradient-to-b from-blue-700 to-blue-800 text-white text-center overflow-hidden py-16 md:py-20">
    <div class="absolute inset-0 bg-repeat bg-center opacity-5" style="background-image: url('/patterns/subtle-dots.svg');"></div>
    <div class="container mx-auto px-6 relative z-10">
      <h1
        class="text-4xl md:text-5xl font-extrabold leading-tight mb-4 transform hover:scale-105 transition-transform duration-300"
        in:fade={{ duration: 800, easing: cubicOut }}
        aria-label="Contáctanos"
      >
        Contáctanos
      </h1>
      <p
        class="text-lg md:text-xl text-blue-100 mb-8 max-w-3xl mx-auto"
        in:slide={{ duration: 800, delay: 200, easing: cubicOut }}
      >
        Estamos aquí para escucharte. Encuentra la oficina más cercana o envíanos un mensaje.
      </p>
      <div in:slide={{ duration: 800, delay: 400, easing: cubicOut }}>
        <a
          href="#form"
          class="bg-white text-blue-700 font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Ir al formulario de contacto"
        >
          Enviar Mensaje
        </a>
      </div>
    </div>
    <div class="absolute bottom-0 left-0 w-full leading-[0] animate-wave">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="#ffffff"
          fill-opacity="0.3"
          d="M0,160L48,170.7C96,181,192,203,288,208C384,213,480,203,576,170.7C672,139,768,85,864,80C960,75,1056,117,1152,133.3C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        ></path>
        <path
          fill="#f9fafb"
          fill-opacity="1"
          d="M0,224L48,208C96,192,192,160,288,160C384,160,480,192,576,218.7C672,245,768,267,864,250.7C960,235,1056,181,1152,170.7C1248,160,1344,192,1392,208L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        ></path>
      </svg>
    </div>
  </section>
  
  <!-- Main Content Area -->
  <section class="container mx-auto px-6 py-16">
    <!-- Contact Information Section -->
    <div class="mb-12" in:fade={{ duration: 800, easing: cubicOut }}>
      <ContactInfo />
    </div>
    
    <div class="grid lg:grid-cols-2 gap-8 md:gap-16">
      <!-- Left Side: Map -->
      <div in:fade={{ duration: 800, easing: cubicOut }}>
        <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
          Nuestras Oficinas en Ciudad Juárez
        </h2>
        <div class="rounded-lg overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
          <OfficeMap defaultZoom={12} />
        </div>
      </div>
  
      <!-- Right Side: Contact Form and Info -->
      <div in:slide={{ duration: 800, delay: 200, easing: cubicOut }}>
        <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4">Envíanos un Mensaje</h2>
        <form id="form" class="space-y-6 bg-white p-8 rounded-lg shadow-lg" on:submit={handleSubmit}>
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Nombre Completo</label>
            <input
              type="text"
              id="name"
              bind:value={formData.name}
              on:input={(e) => handleFieldChange('name', e.target.value)}
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="Ingresa tu nombre completo"
              required
              aria-required="true"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              bind:value={formData.email}
              on:input={(e) => handleFieldChange('email', e.target.value)}
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="Ingresa tu correo electrónico"
              required
              aria-required="true"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
            <input
              type="tel"
              id="phone"
              bind:value={formData.phone}
              on:input={(e) => handleFieldChange('phone', e.target.value)}
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="Ingresa tu número de teléfono"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label for="message" class="block text-sm font-medium text-gray-700">Mensaje</label>
            <textarea
              id="message"
              bind:value={formData.message}
              on:input={(e) => handleFieldChange('message', e.target.value)}
              rows="4"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              placeholder="Escribe tu mensaje aquí"
              required
              aria-required="true"
              disabled={isSubmitting}
            ></textarea>
          </div>
          <div>
            <button
              type="submit"
              class="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              aria-label="Enviar mensaje"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
  
  <style>
    @keyframes wave {
      0% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0); }
    }
    .animate-wave {
      animation: wave 4s ease-in-out infinite;
    }
  </style>
