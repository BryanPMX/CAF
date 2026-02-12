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

  // Image sections: hero + inicio (carousel), gallery (grid), about (Sobre Nosotros block)
  let gallerySectionImages = [];
  let aboutSectionImages = [];

  try {
    const [contentRes, heroImagesRes, inicioImagesRes, gallerySectionRes, aboutSectionRes, servicesRes] = await Promise.allSettled([
      fetch(`${baseUrl}/public/site-content`),
      fetch(`${baseUrl}/public/site-images?section=hero`),
      fetch(`${baseUrl}/public/site-images?section=inicio`),
      fetch(`${baseUrl}/public/site-images?section=gallery`),
      fetch(`${baseUrl}/public/site-images?section=about`),
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

    function toSlide(img) {
      return { src: img.imageUrl || '', alt: img.altText || img.title || '' };
    }

    // Hero (Portada): optional hero imagery; also fallback for carousel
    if (heroImagesRes.status === 'fulfilled' && heroImagesRes.value?.ok) {
      const data = await safeJson(heroImagesRes.value);
      if (data && Array.isArray(data.images)) {
        images = data.images.map(img => ({ ...toSlide(img), alt: img.altText || img.title || 'Imagen comunitaria' }));
      }
    }

    // Inicio: primary source for "Nuestra comunidad" carousel
    if (inicioImagesRes.status === 'fulfilled' && inicioImagesRes.value?.ok) {
      const data = await safeJson(inicioImagesRes.value);
      if (data && Array.isArray(data.images)) {
        galleryImages = data.images.map(img => ({ ...toSlide(img), alt: img.altText || img.title || 'Nuestra comunidad' }));
      }
    }
    if (galleryImages.length === 0 && images.length > 0) {
      galleryImages = images.map(({ src, alt }) => ({ src, alt: alt || 'Nuestra comunidad' }));
    }

    // Galería section: grid on homepage
    if (gallerySectionRes.status === 'fulfilled' && gallerySectionRes.value?.ok) {
      const data = await safeJson(gallerySectionRes.value);
      if (data && Array.isArray(data.images)) {
        gallerySectionImages = data.images.map(img => ({ src: img.imageUrl || '', alt: img.altText || img.title || 'Galería' }));
      }
    }

    // Sobre Nosotros section: images in About block
    if (aboutSectionRes.status === 'fulfilled' && aboutSectionRes.value?.ok) {
      const data = await safeJson(aboutSectionRes.value);
      if (data && Array.isArray(data.images)) {
        aboutSectionImages = data.images.map(img => ({ src: img.imageUrl || '', alt: img.altText || img.title || 'Sobre nosotros' }));
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
  if (!Array.isArray(gallerySectionImages)) gallerySectionImages = [];
  if (!Array.isArray(aboutSectionImages)) aboutSectionImages = [];

  return { content, images, galleryImages, gallerySectionImages, aboutSectionImages, services };
}
