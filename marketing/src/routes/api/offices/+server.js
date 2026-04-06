import { json } from '@sveltejs/kit';
import { fetchPublicApi, parseJsonResponse } from '$lib/utils/publicApiProxy.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
  let upstreamResponse;
  try {
    upstreamResponse = await fetchPublicApi('/public/offices', { method: 'GET' });
  } catch {
    return json({ success: false, error: 'No se pudo obtener el catálogo de oficinas.' }, { status: 502 });
  }

  const upstreamData = await parseJsonResponse(upstreamResponse);
  if (!upstreamResponse.ok) {
    console.warn('[Offices API] Upstream request failed', { status: upstreamResponse.status });
    return json(
      {
        success: false,
        error: upstreamData?.error || 'No se pudo obtener el catálogo de oficinas.'
      },
      { status: upstreamResponse.status }
    );
  }

  return json(upstreamData ?? []);
}
