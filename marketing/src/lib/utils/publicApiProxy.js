import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export const UPSTREAM_TIMEOUT_MS = 10000;
export const DEFAULT_PUBLIC_API_BASE_URL = 'https://api.caf-mexico.com/api/v1';

export function resolveApiBaseUrl() {
  const fromPrivate = privateEnv.API_URL || '';
  const fromPublic = publicEnv.VITE_API_URL || '';
  return (fromPrivate || fromPublic || DEFAULT_PUBLIC_API_BASE_URL).replace(/\/+$/, '');
}

export async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Performs a server-side fetch to the public API without inheriting browser-facing
 * origin metadata. This avoids upstream 403s when the marketing proxy is called
 * from a host/origin that the API rejects even though the API itself is public.
 */
export async function fetchPublicApi(pathname, init = {}) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('API no configurada en el servidor.');
  }

  const headers = new Headers(init.headers || {});
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }
  if (!headers.has('user-agent')) {
    headers.set('user-agent', 'CAF Marketing Proxy/1.0');
  }

  // Strip browser-oriented headers so this request behaves like a neutral
  // server-to-server call instead of a cross-origin browser request.
  headers.delete('origin');
  headers.delete('referer');

  return globalThis.fetch(`${apiBaseUrl}${pathname}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  });
}
