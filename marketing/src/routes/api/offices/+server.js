import { json } from '@sveltejs/kit';
import { parseJsonResponse, resolveApiBaseUrl, UPSTREAM_TIMEOUT_MS } from '$lib/utils/publicApiProxy.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ fetch }) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) {
    return json({ success: false, error: 'API no configurada en el servidor.' }, { status: 500 });
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(`${apiBaseUrl}/public/offices`, {
      method: 'GET',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch {
    return json({ success: false, error: 'No se pudo obtener el catálogo de oficinas.' }, { status: 502 });
  }

  const upstreamData = await parseJsonResponse(upstreamResponse);
  if (!upstreamResponse.ok) {
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
