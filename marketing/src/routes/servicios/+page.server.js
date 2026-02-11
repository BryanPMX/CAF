// marketing/src/routes/servicios/+page.server.js
// Fetches services from the public CMS API. Falls back to defaults if unreachable.
import { config } from '$lib/config.js';

const FALLBACK_SERVICES = [
  {
    title: 'Asesoría Legal',
    description: 'Navegar el sistema legal puede ser abrumador. Nuestro equipo de abogados experimentados le brinda orientación clara y representación en una variedad de asuntos legales para proteger sus derechos y los de su familia.',
    details: ['Derecho Familiar (divorcio, custodia)', 'Asuntos Civiles', 'Orientación en trámites migratorios', 'Contratos y acuerdos'],
    imageUrl: '',
  },
  {
    title: 'Apoyo Psicológico',
    description: 'La salud mental es fundamental para el bienestar familiar. Ofrecemos servicios de terapia y consejería para individuos, parejas y familias, en un ambiente seguro y confidencial.',
    details: ['Terapia individual para adultos y adolescentes', 'Terapia de pareja y familiar', 'Manejo de estrés y ansiedad', 'Grupos de apoyo'],
    imageUrl: '',
  },
  {
    title: 'Asistencia Social',
    description: 'Entendemos que los desafíos de la vida pueden ser complejos. Nuestros trabajadores sociales le ayudan a acceder a recursos comunitarios, programas de asistencia y redes de apoyo.',
    details: ['Acceso a programas de alimentos y vivienda', 'Asistencia para solicitudes de beneficios', 'Orientación laboral y educativa', 'Conexión con servicios de salud'],
    imageUrl: '',
  },
];

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
  try {
    const res = await fetch(`${config.api.baseUrl}/public/site-services`);
    if (res.ok) {
      const data = await res.json();
      const services = data.services || [];
      return { services: services.length > 0 ? services : FALLBACK_SERVICES };
    }
  } catch (err) {
    console.warn('[Services SSR] API fetch failed, using fallback:', err?.message);
  }
  return { services: FALLBACK_SERVICES };
}
