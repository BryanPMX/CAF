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

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
  let content = { ...DEFAULTS };
  let images = [];
  let galleryImages = [];
  let services = [];

  const baseUrl = (typeof config?.api?.baseUrl === 'string' && config.api.baseUrl) || 'https://api.caf-mexico.com/api/v1';

  try {
    const [contentRes, heroImagesRes, galleryImagesRes, servicesRes] = await Promise.allSettled([
      fetch(`${baseUrl}/public/site-content`),
      fetch(`${baseUrl}/public/site-images?section=hero`),
      fetch(`${baseUrl}/public/site-images?section=inicio`),
      fetch(`${baseUrl}/public/site-services`),
    ]);

    // Parse content (safe JSON)
    if (contentRes.status === 'fulfilled' && contentRes.value?.ok) {
      const data = await safeJson(contentRes.value) || {};
      if (data && typeof data.content === 'object' && data.content !== null) {
        for (const [section, items] of Object.entries(data.content)) {
          if (!Array.isArray(items)) continue;
          if (!content[section] || typeof content[section] !== 'object') content[section] = {};
          for (const item of items) {
            if (item && item.contentKey != null) content[section][item.contentKey] = item.contentValue ?? '';
          }
        }
      }
    }

    // Parse hero images
    if (heroImagesRes.status === 'fulfilled' && heroImagesRes.value?.ok) {
      const data = await safeJson(heroImagesRes.value);
      if (data && Array.isArray(data.images)) {
        images = data.images.map(img => ({
          src: img.imageUrl || '',
          alt: img.altText || img.title || 'Imagen comunitaria',
        }));
      }
    }

    // Inicio/carousel images: prefer "inicio" section, then gallery
    if (galleryImagesRes.status === 'fulfilled' && galleryImagesRes.value?.ok) {
      const data = await safeJson(galleryImagesRes.value);
      if (data && Array.isArray(data.images)) {
        galleryImages = data.images.map(img => ({
          src: img.imageUrl || '',
          alt: img.altText || img.title || 'Nuestra comunidad',
        }));
      }
    }
    if (galleryImages.length === 0 && heroImagesRes.status === 'fulfilled' && heroImagesRes.value?.ok) {
      const data = await safeJson(heroImagesRes.value);
      if (data && Array.isArray(data.images)) {
        galleryImages = data.images.map(img => ({
          src: img.imageUrl || '',
          alt: img.altText || img.title || 'Nuestra comunidad',
        }));
      }
    }

    // Parse services
    if (servicesRes.status === 'fulfilled' && servicesRes.value?.ok) {
      const data = await safeJson(servicesRes.value);
      if (data && Array.isArray(data.services)) services = data.services.slice(0, 3);
    }
  } catch (err) {
    console.warn('[Homepage SSR] API fetch failed, using defaults:', err?.message);
  }

  if (images.length === 0) {
    images = [
      { src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=600&fit=crop', alt: 'Familias unidas' },
      { src: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=1200&h=600&fit=crop', alt: 'Comunidad solidaria' },
      { src: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1200&h=600&fit=crop', alt: 'Apoyo profesional' },
    ];
  }
  if (!Array.isArray(galleryImages)) galleryImages = [];

  return { content, images, galleryImages, services };
}
