<!-- marketing/src/lib/components/ContactInfo.svelte -->
<script>
  const contactInfo = {
    phone: '+1-915-555-0123',
    email: 'info@caf-mexico.org',
    address: 'Ciudad Juárez, Chihuahua',
    hours: {
      weekdays: '8:00 AM - 6:00 PM',
      saturday: '9:00 AM - 2:00 PM',
      sunday: 'Cerrado'
    }
  };
</script>

<div class="bg-white rounded-lg shadow-lg p-6">
  <h3 class="text-xl font-semibold text-gray-800 mb-4">Información de Contacto</h3>
  
  <div class="space-y-4">
    <!-- Phone -->
    <div class="flex items-center space-x-3">
      <div class="bg-blue-100 text-blue-600 rounded-full h-10 w-10 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
        </svg>
      </div>
      <div>
        <p class="text-sm text-gray-600">Teléfono</p>
        <a href="tel:{contactInfo.phone}" class="text-blue-600 font-medium hover:text-blue-800">
          {contactInfo.phone}
        </a>
      </div>
    </div>
    
    <!-- Email -->
    <div class="flex items-center space-x-3">
      <div class="bg-green-100 text-green-600 rounded-full h-10 w-10 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
      </div>
      <div>
        <p class="text-sm text-gray-600">Correo Electrónico</p>
        <a href="mailto:{contactInfo.email}" class="text-blue-600 font-medium hover:text-blue-800">
          {contactInfo.email}
        </a>
      </div>
    </div>
    
    <!-- Address -->
    <div class="flex items-center space-x-3">
      <div class="bg-orange-100 text-orange-600 rounded-full h-10 w-10 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>
      <div>
        <p class="text-sm text-gray-600">Ubicación</p>
        <p class="text-gray-800 font-medium">{contactInfo.address}</p>
      </div>
    </div>
    
    <!-- Hours -->
    <div class="flex items-start space-x-3">
      <div class="bg-purple-100 text-purple-600 rounded-full h-10 w-10 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <div>
        <p class="text-sm text-gray-600">Horarios de Atención</p>
        <div class="text-sm text-gray-800">
          <p><strong>Lunes - Viernes:</strong> {contactInfo.hours.weekdays}</p>
          <p><strong>Sábado:</strong> {contactInfo.hours.saturday}</p>
          <p><strong>Domingo:</strong> {contactInfo.hours.sunday}</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Emergency Contact -->
  <div class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
    <h4 class="text-sm font-semibold text-red-800 mb-2">🚨 Contacto de Emergencia</h4>
    <p class="text-sm text-red-700">
      Para situaciones de emergencia fuera del horario de atención, 
      llame al <strong>{contactInfo.phone}</strong> y siga las instrucciones.
    </p>
  </div>
</div>
