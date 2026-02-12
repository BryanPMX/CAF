// marketing/src/routes/+page.server.js
// Fetches CMS content for the homepage from the public API.
// Falls back to defaults if the API is unreachable (resilient SSR).
import { config } from '$lib/config.js';

const DEFAULTS = {
  hero: {
    title: 'Fortaleciendo Familias, Construyendo Comunidad',
    subtitle: 'Centro de Apoyo para la Familia A.C. brinda servicios legales, psicológicos y de asistencia social a familias que lo necesitan.',
    cta_primary: 'Contáctenos',
    cta_secondary: 'Nuestros Servicios',
  },
  about: {
    title: 'Sobre Nosotros',
    description: 'Somos una organización sin fines de lucro dedicada a fortalecer el núcleo familiar a través de servicios integrales de apoyo legal, psicológico y social.',
    mission: 'Nuestra misión es brindar apoyo integral a familias en situación de vulnerabilidad.',
    vision: 'Ser la organización líder en el apoyo y fortalecimiento familiar en nuestra región.',
  },
};

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
  let content = DEFAULTS;
  let images = [];
  let services = [];

  try {
    const [contentRes, heroImagesRes, galleryImagesRes, servicesRes] = await Promise.allSettled([
      fetch(`${config.api.baseUrl}/public/site-content`),
      fetch(`${config.api.baseUrl}/public/site-images?section=hero`),
      fetch(`${config.api.baseUrl}/public/site-images?section=gallery`),
      fetch(`${config.api.baseUrl}/public/site-services`),
    ]);

    // Parse content
    if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
      const data = await contentRes.value.json();
      const grouped = data.content || {};
      // Flatten key-value pairs into section objects
      for (const [section, items] of Object.entries(grouped)) {
        if (!content[section]) content[section] = {};
        for (const item of items) {
          content[section][item.contentKey] = item.contentValue;
        }
      }
    }

    // Parse hero images
    if (heroImagesRes.status === 'fulfilled' && heroImagesRes.value.ok) {
      const data = await heroImagesRes.value.json();
      images = (data.images || []).map(img => ({
        src: img.imageUrl,
        alt: img.altText || img.title || 'Imagen comunitaria',
      }));
    }

    // Parse gallery images and merge with hero images for the carousel
    let galleryImages = [];
    if (galleryImagesRes.status === 'fulfilled' && galleryImagesRes.value.ok) {
      const data = await galleryImagesRes.value.json();
      galleryImages = (data.images || []).map(img => ({
        src: img.imageUrl,
        alt: img.altText || img.title || 'Nuestra comunidad',
      }));
    }

    // Parse services for homepage preview
    if (servicesRes.status === 'fulfilled' && servicesRes.value.ok) {
      const data = await servicesRes.value.json();
      services = (data.services || []).slice(0, 3);
    }
  } catch (err) {
    console.warn('[Homepage SSR] API fetch failed, using defaults:', err?.message);
  }

  // Fallback carousel images if none from CMS
  if (images.length === 0) {
    images = [
      { src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=600&fit=crop', alt: 'Familias unidas' },
      { src: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=1200&h=600&fit=crop', alt: 'Comunidad solidaria' },
      { src: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1200&h=600&fit=crop', alt: 'Apoyo profesional' },
    ];
  }

  return { content, images, galleryImages, services };
}
