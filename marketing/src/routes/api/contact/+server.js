import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { parseJsonResponse, resolveApiBaseUrl, UPSTREAM_TIMEOUT_MS } from '$lib/utils/publicApiProxy.js';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 8000;

function sanitizePrintable(value = '') {
  return value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function normalizeContactPayload(raw = {}) {
  const officeIdRaw = raw.officeId == null ? '' : String(raw.officeId).trim();
  const hasOfficeId = officeIdRaw !== '';
  const officeIdIsValid = !hasOfficeId || /^\d+$/.test(officeIdRaw);
  const officeId = hasOfficeId && officeIdIsValid ? Number.parseInt(officeIdRaw, 10) : null;

  return {
    name: sanitizePrintable(String(raw.name || '')),
    email: sanitizePrintable(String(raw.email || '')).toLowerCase(),
    phone: sanitizePrintable(String(raw.phone || '')),
    message: sanitizePrintable(String(raw.message || '')),
    officeId: Number.isNaN(officeId) ? null : officeId,
    turnstileToken: String(raw.turnstileToken || '').trim(),
    officeIdIsValid
  };
}

function getClientIp(request) {
  const header = request.headers.get('x-forwarded-for');
  if (!header) return '';
  return header.split(',')[0].trim();
}

async function verifyTurnstileToken({ token, remoteIp }) {
  const turnstileSecret =
    privateEnv.TURNSTILE_SECRET_KEY ||
    privateEnv.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    '';
  const turnstileSiteKey = publicEnv.VITE_TURNSTILE_SITE_KEY || '';
  const fallbackTurnstileSiteKey = publicEnv.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '';
  const effectiveSiteKey = turnstileSiteKey || fallbackTurnstileSiteKey;

  if (!turnstileSecret) {
    return { ok: false, error: 'TURNSTILE_SECRET_KEY no está configurada.' };
  }

  const body = new URLSearchParams({
    secret: turnstileSecret,
    response: token
  });

  if (remoteIp) body.set('remoteip', remoteIp);
  if (effectiveSiteKey) body.set('sitekey', effectiveSiteKey);

  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS)
    });
  } catch {
    return { ok: false, error: 'No se pudo verificar el captcha en este momento.' };
  }

  const result = await parseJsonResponse(response);
  if (!response.ok || !result?.success) {
    return { ok: false, error: 'Verificación de captcha inválida.', details: result };
  }

  return { ok: true };
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, fetch }) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return json({ success: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const payload = normalizeContactPayload(rawBody);

  if (!payload.name || !payload.email || !payload.message) {
    return json({ success: false, error: 'Nombre, correo y mensaje son obligatorios.' }, { status: 400 });
  }

  if (!payload.officeIdIsValid) {
    return json({ success: false, error: 'La oficina seleccionada no es válida.' }, { status: 400 });
  }

  if (!payload.turnstileToken) {
    return json({ success: false, error: 'Completa la verificación de captcha.' }, { status: 400 });
  }

  const turnstileCheck = await verifyTurnstileToken({
    token: payload.turnstileToken,
    remoteIp: getClientIp(request)
  });

  if (!turnstileCheck.ok) {
    console.warn('[Contact API] Turnstile verification failed:', turnstileCheck.error, turnstileCheck.details || '');
    return json({ success: false, error: 'No pudimos validar el captcha. Intenta nuevamente.' }, { status: 400 });
  }

  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) {
    return json({ success: false, error: 'API no configurada en el servidor.' }, { status: 500 });
  }

  const upstreamPayload = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    message: payload.message
  };

  if (payload.officeId != null) {
    upstreamPayload.officeId = payload.officeId;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(`${apiBaseUrl}/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamPayload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch {
    return json({ success: false, error: 'No se pudo contactar al servicio de contacto.' }, { status: 502 });
  }

  const upstreamData = await parseJsonResponse(upstreamResponse);
  if (!upstreamResponse.ok) {
    return json(
      {
        success: false,
        error: upstreamData?.error || 'No se pudo enviar el mensaje.'
      },
      { status: upstreamResponse.status }
    );
  }

  return json(
    upstreamData || {
      success: true,
      message: 'Mensaje enviado correctamente. Nos pondremos en contacto pronto.'
    },
    { status: upstreamResponse.status }
  );
}
