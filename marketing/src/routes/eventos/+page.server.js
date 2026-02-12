// marketing/src/routes/eventos/+page.server.js
// Fetches public events from the CMS API. Falls back to empty array if unreachable.
import { config } from '$lib/config.js';

const baseUrl = (typeof config?.api?.baseUrl === 'string' && config.api.baseUrl) || 'https://api.caf-mexico.com/api/v1';

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
  let events = [];
  try {
    const res = await fetch(`${baseUrl}/public/site-events`);
    if (res.ok) {
      const data = await safeJson(res);
      const raw = (data?.events && Array.isArray(data.events)) ? data.events : [];
      events = raw.map(evt => {
        const d = new Date(evt.eventDate || 0);
        const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        return {
          ...evt,
          date: {
            day: String(d.getDate()).padStart(2, '0'),
            month: months[d.getMonth()] || '',
            year: String(d.getFullYear()),
          },
          time: isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
      });
    }
  } catch (err) {
    console.warn('[Events SSR] API fetch failed:', err?.message);
  }
  return { events };
}
