const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const portal = 'http://127.0.0.1:3100';
const api = 'http://localhost:8080/api/v1';
const artifacts = process.env.CAF_E2E_ARTIFACT_DIR || '/tmp/caf-profile-e2e';
const roles = ['technical_support', 'executive_director', 'admin', 'office_manager', 'lawyer', 'psychologist', 'receptionist', 'event_coordinator', 'client'];
const emails = { technical_support: 'support@example.test', executive_director: 'ceo@example.test', admin: 'a@example.test' };

async function login(page, role) {
  await page.goto(`${portal}/login`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(emails[role] || `${role}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.waitForURL(`${portal}/`);
}

for (const role of roles) {
  test(`${role}: useful profile details without redundant or out-of-scope fields`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: role === 'lawyer' ? { width: 390, height: 844 } : { width: 1440, height: 1050 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await login(page, role);
      await page.goto(`${portal}/app/profile`);
      await page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor();
      const contact = page.getByRole('region', { name: 'Contacto y organización', exact: true });
      await contact.getByText(emails[role] || `${role}@example.test`, { exact: true }).waitFor();
      await contact.getByText('6561234567', { exact: true }).waitFor();
      const global = ['technical_support', 'executive_director'].includes(role);
      assert.equal(await contact.getByText('Oficina', { exact: true }).count(), global ? 0 : 1);
      if (!global) await contact.getByText('Office A', { exact: true }).waitFor();
      assert.equal(await contact.getByText('Departamento', { exact: true }).count(), role === 'lawyer' ? 1 : 0);
      assert.equal(await contact.getByText('Especialidad', { exact: true }).count(), role === 'lawyer' ? 1 : 0);
      const account = page.getByRole('region', { name: 'Cuenta', exact: true });
      await account.getByText('Miembro desde', { exact: true }).waitFor();
      await account.getByText('Último inicio de sesión', { exact: true }).waitFor();
      assert.ok((await account.innerText()).includes('2024'));
      assert.equal(await page.getByRole('button', { name: 'Editar datos', exact: true }).count(), ['technical_support', 'executive_director', 'admin', 'office_manager'].includes(role) ? 1 : 0);
      assert.equal(await page.getByLabel('Enlace de la foto', { exact: true }).isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      if (['technical_support', 'lawyer'].includes(role)) {
        await fs.mkdir(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${role}-profile.png`), fullPage: true, animations: 'disabled' });
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('profile loading failure has an honest empty state and retry', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page, 'admin');
    let fail = true;
    await page.route('**/api/v1/profile', route => {
      if (fail && route.request().method() === 'GET') {
        return route.fulfill({ status: 500, json: { error: 'Synthetic failure' } });
      }
      return route.continue();
    });
    await page.goto(`${portal}/app/profile`);
    await page.getByText('No se pudo cargar el perfil.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Contacto y organización', exact: true }).count(), 0);
    fail = false;
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await page.getByRole('region', { name: 'Contacto y organización', exact: true }).getByText('a@example.test', { exact: true }).waitFor();
  } finally { await browser.close(); }
});

test('photo controls validate links, persist changes and clear the avatar', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page, 'technical_support');
    await page.route('https://profile-images.example.test/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV+kAAAAASUVORK5CYII=', 'base64') }));
    await page.goto(`${portal}/app/profile`);
    await page.getByText('Cambiar foto de perfil', { exact: true }).click();
    const input = page.getByLabel('Enlace de la foto', { exact: true });
    await input.fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Usar enlace', exact: true }).click();
    await page.getByText('Use un enlace http o https válido.', { exact: true }).waitFor();
    const url = 'https://profile-images.example.test/avatar.png';
    await input.fill(url);
    const updated = page.waitForResponse(response => response.url().endsWith('/profile') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Usar enlace', exact: true }).click();
    assert.equal((await updated).status(), 200);
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('userData')).avatarUrl === expected, url);
    const removed = page.waitForResponse(response => response.url().endsWith('/profile') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Quitar foto', exact: true }).click();
    assert.equal((await removed).status(), 200);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('userData')).avatarUrl === '');
    assert.equal(await page.getByRole('button', { name: 'Quitar foto', exact: true }).count(), 0);
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await page.getByText('Seleccione una imagen JPEG, PNG, GIF o WebP.', { exact: true }).waitFor();
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const persisted = await page.request.get(`${api}/profile`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await persisted.json()).avatarUrl, '');
  } finally { await browser.close(); }
});
