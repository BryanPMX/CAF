// marketing/src/routes/servicios/+page.server.js
/**
 * This is a SvelteKit loader function. It runs on the server before the page is rendered.
 * Its job is to fetch data that the page needs. Here, we are SIMULATING a call
 * to our Go API to get the list of services and their associated images.
 *
 * In the future, this will be a real `fetch` call to an endpoint like `GET /api/v1/services`.
 */
export async function load() {
    // Simulated data that will eventually come from your Go API and S3.
    const services = [
      {
        title: 'Asesoría Legal',
        description: 'Navegar el sistema legal puede ser abrumador. Nuestro equipo de expertos legales está aquí para ofrecerle orientación clara y confidencial en una variedad de áreas, asegurando que sus derechos sean protegidos en cada paso.',
        details: ['Derecho Familiar (divorcio, custodia)', 'Asuntos Civiles', 'Orientación en trámites migratorios', 'Contratos y acuerdos'],
        // The Event Coordinator will upload this image via the Admin Portal.
        imageUrl: '[https://placehold.co/600x400/3b82f6/ffffff?text=Asesor%C3%ADa+Legal](https://placehold.co/600x400/3b82f6/ffffff?text=Asesor%C3%ADa+Legal)'
      },
      {
        title: 'Apoyo Psicológico',
        description: 'La salud mental es fundamental para el bienestar familiar. Ofrecemos un espacio seguro y de apoyo donde individuos, parejas y familias pueden encontrar las herramientas para superar desafíos, mejorar la comunicación y fortalecer sus lazos.',
        details: ['Terapia individual para adultos y adolescentes', 'Terapia de pareja y familiar', 'Manejo de estrés y ansiedad', 'Grupos de apoyo'],
        imageUrl: '[https://placehold.co/600x400/10b981/ffffff?text=Apoyo+Psicol%C3%B3gico](https://placehold.co/600x400/10b981/ffffff?text=Apoyo+Psicol%C3%B3gico)'
      },
      {
        title: 'Asistencia Social',
        description: 'Entendemos que los desafíos de la vida a menudo van más allá de lo legal o emocional. Nuestro equipo de asistencia social le ayuda a conectar con los recursos vitales de la comunidad para asegurar la estabilidad y el bienestar de su hogar.',
        details: ['Acceso a programas de alimentos y vivienda', 'Asistencia para solicitudes de beneficios', 'Orientación laboral y educativa', 'Conexión con servicios de salud'],
        imageUrl: '[https://placehold.co/600x400/f97316/ffffff?text=Asistencia+Social](https://placehold.co/600x400/f97316/ffffff?text=Asistencia+Social)'
      }
    ];
  
    return {
      services
    };
  }