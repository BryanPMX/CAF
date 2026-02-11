// marketing/src/routes/eventos/+page.server.js
// Fetches public events from the CMS API. Falls back to empty array if unreachable.
import { config } from '$lib/config.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
  try {
    const res = await fetch(`${config.api.baseUrl}/public/site-events`);
    if (res.ok) {
      const data = await res.json();
      const events = (data.events || []).map(evt => {
        const d = new Date(evt.eventDate);
        const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        return {
          ...evt,
          date: {
            day: String(d.getDate()).padStart(2, '0'),
            month: months[d.getMonth()],
            year: String(d.getFullYear()),
          },
          time: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
      });
      return { events };
    }
  } catch (err) {
    console.warn('[Events SSR] API fetch failed:', err?.message);
  }
  return { events: [] };
}
