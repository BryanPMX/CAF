// marketing/src/lib/utils/turnstileClient.js
// Client-side helpers for Cloudflare Turnstile.

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptLoadPromise = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export async function loadTurnstileScript() {
  if (!isBrowser()) return null;

  if (window.turnstile) return window.turnstile;

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.turnstile), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Cloudflare Turnstile.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('No se pudo cargar Cloudflare Turnstile.'));
      document.head.appendChild(script);
    });
  }

  return scriptLoadPromise;
}

export function resetTurnstileWidget(widgetId) {
  if (!isBrowser()) return;
  if (!window.turnstile) return;
  if (widgetId == null) return;
  window.turnstile.reset(widgetId);
}
