import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export const UPSTREAM_TIMEOUT_MS = 10000;

export function resolveApiBaseUrl() {
  const fromPrivate = privateEnv.API_URL || '';
  const fromPublic = publicEnv.VITE_API_URL || '';
  return (fromPrivate || fromPublic).replace(/\/+$/, '');
}

export async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
