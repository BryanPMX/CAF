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
