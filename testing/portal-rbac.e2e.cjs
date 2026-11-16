// Start the synthetic Go preview and portal as documented in testing/README.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const portal = 'http://127.0.0.1:3100';
const api = 'http://localhost:8080/api/v1';
const artifacts = process.env.CAF_E2E_ARTIFACT_DIR || '/tmp/caf-rbac-e2e';

for (const role of ['admin', 'executive_director', 'technical_support']) {
  test(`${role}: login, dashboard scope, navigation and user role choices`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    try {
      await page.goto(`${portal}/login`);
      await page.getByLabel('Correo electrónico', { exact: true }).fill(role === 'admin' ? 'a@example.test' : role === 'technical_support' ? 'support@example.test' : 'ceo@example.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.waitForURL(`${portal}/`);
      await page.getByRole('heading', { name: /Panel de Control/i }).waitFor();
      const executive = role !== 'admin';
      assert.equal(await page.getByRole('menuitem', { name: /Sitio Web/ }).count(), executive ? 1 : 0);
      if (executive) {
        await page.getByText(role === 'technical_support' ? 'Soporte Tecnico' : 'Director Ejecutivo', { exact: true }).first().waitFor();
        await page.getByRole('combobox', { name: 'Filtrar por oficina' }).waitFor();
      } else {
        await page.getByRole('menuitem', { name: /Oficinas/ }).waitFor();
        await page.getByText('Oficina asignada', { exact: true }).waitFor();
        assert.equal(await page.getByRole('combobox', { name: 'Filtrar por oficina' }).count(), 0);
      }
      await fs.mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, `${role}-dashboard.png`), fullPage: true, animations: 'disabled' });

      // The request uses the real login JWT against the isolated Go handlers.
      const token = await page.evaluate(() => localStorage.getItem('authToken'));
      const headers = { Authorization: `Bearer ${token}` };
      const cases = await page.request.get(`${api}/admin/cases`, { headers });
      assert.equal(cases.status(), 200);
      assert.equal((await cases.json()).data.length, executive ? 2 : 1);
      const website = await page.request.get(`${api}/admin/site-content`, { headers });
      assert.equal(website.status(), executive ? 200 : 403);

      await page.getByRole('menuitem', { name: /Usuarios/ }).click();
      const executiveRow = page.getByRole('row').filter({ hasText: 'ceo@example.test' });
      await executiveRow.waitFor();
      assert.equal((await executiveRow.getByRole('cell').nth(3).innerText()).trim(), '');
      if (executive) {
        await executiveRow.getByRole('button', { name: 'Editar a CEO CAF', exact: true }).click();
        const editor = page.getByRole('dialog');
        await editor.getByLabel('Nombre(s)', { exact: true }).waitFor();
        assert.equal(await editor.getByLabel('Oficina', { exact: true }).count(), 0);
        assert.equal(await editor.getByLabel('Nueva contraseña', { exact: true }).count(), role === 'technical_support' ? 1 : 0);
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        await editor.waitFor({ state: 'hidden' });
      } else {
        await executiveRow.getByText('Solo lectura', { exact: true }).waitFor();
        assert.equal(await executiveRow.getByRole('button').count(), 0);
        const protectedEdit = await page.request.patch(`${api}/admin/users/18`, {
          headers, data: { firstName: 'Changed', lastName: 'CAF', email: 'ceo@example.test', role: 'admin', officeId: 1, phone: '1234567890' },
        });
        assert.equal(protectedEdit.status(), 403);
        const localRow = page.getByRole('row').filter({ hasText: 'a@example.test' });
        await localRow.getByRole('button', { name: 'Editar a Admin A CAF', exact: true }).click();
        await page.getByRole('dialog').getByLabel('Nombre(s)', { exact: true }).waitFor();
        assert.equal(await page.getByRole('dialog').getByLabel('Nueva contraseña', { exact: true }).count(), 0);
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      if (executive) {
        const supportRow = page.getByRole('row').filter({ hasText: 'support@example.test' });
        if (role === 'technical_support') {
          await supportRow.getByRole('button', { name: 'Editar a Technical Support', exact: true }).click();
          await page.getByRole('dialog').getByLabel('Rol', { exact: true }).waitFor();
          assert.equal(await page.getByRole('dialog').getByLabel('Rol', { exact: true }).isDisabled(), true);
          await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
        } else {
          await supportRow.getByText('Solo lectura', { exact: true }).waitFor();
          assert.equal(await supportRow.getByRole('button').count(), 0);
        }
      }
      await page.screenshot({ path: path.join(artifacts, `${role}-users.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: /Crear Usuario/ }).click();
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Rol', { exact: true }).click();
      assert.equal(await page.getByRole('option', { name: 'Director Ejecutivo', exact: true }).count(), executive ? 1 : 0);
      assert.equal(await page.getByRole('option', { name: 'Soporte Tecnico', exact: true }).count(), 0);
      await page.keyboard.press('Escape');
      await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
      if (executive) {
        await page.goto(`${portal}/app/users/18`);
        await page.getByRole('heading', { name: 'CEO CAF', exact: true }).waitFor();
        assert.equal(await page.getByText('Oficina', { exact: true }).count(), 0);
      } else {
        await page.goto(`${portal}/app/users?edit=18`);
        await page.waitForURL(url => url.pathname === '/app/users' && !url.searchParams.has('edit'));
        assert.equal(await page.getByRole('dialog').count(), 0);
      }
      if (!executive) {
        await page.goto(`${portal}/app/web-content`);
        await page.waitForURL(`${portal}/`);
      }
      assert.deepEqual(failures, []);
    } finally {
      await browser.close();
    }
  });
}

test('a stale administrator row cannot open the editor after promotion', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route('**/api/v1/admin/users?*', async route => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.data = payload.data.map(user => user.id === 18 ? { ...user, role: 'admin' } : user);
      await route.fulfill({ response, json: payload });
    });
    await page.goto(`${portal}/login`);
    await page.getByLabel('Correo electrónico', { exact: true }).fill('a@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForURL(`${portal}/`);
    await page.getByRole('menuitem', { name: /Usuarios/ }).click();
    const currentTarget = page.waitForResponse(response => response.url().endsWith('/admin/users/18'));
    await page.getByRole('row').filter({ hasText: 'ceo@example.test' }).getByRole('button', { name: 'Editar a CEO CAF', exact: true }).click();
    assert.equal((await currentTarget).status(), 403);
    await page.getByText('No tiene permisos para modificar esta cuenta.', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
  } finally {
    await browser.close();
  }
});


test('support edits user details and resets a password through the portal', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  try {
    await page.goto(`${portal}/login`);
    await page.getByLabel('Correo electrónico', { exact: true }).fill('support@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForURL(`${portal}/`);
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const email = `reset-${Date.now()}@example.test`;
    const original = 'Synthetic-Original-Password123!';
    const replacement = 'Synthetic-Replaced-Password456!';
    const created = await page.request.post(`${api}/admin/users`, { headers: { Authorization: `Bearer ${token}` }, data: {
      firstName: 'Reset', lastName: 'Target', email, password: original, role: 'client', officeId: 2, phone: '6561234567',
    } });
    assert.equal(created.status(), 201);
    const target = await created.json();
    const oldLogin = await page.request.post(`${api}/login`, { data: { email, password: original } });
    assert.equal(oldLogin.status(), 200);
    const oldToken = (await oldLogin.json()).token;
    await page.getByRole('menuitem', { name: /Usuarios/ }).click();
    await page.getByRole('row').filter({ hasText: email }).getByRole('button', { name: 'Editar a Reset Target', exact: true }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Nombre(s)', { exact: true }).fill('Updated');
    await editor.getByLabel('Número de Teléfono', { exact: true }).fill('6569876543');
    await editor.getByLabel('Domicilio Personal (opcional)', { exact: true }).fill('Synthetic updated address');
    await editor.getByLabel('Nueva contraseña', { exact: true }).fill(replacement);
    await page.screenshot({ path: path.join(artifacts, 'support-password-editor.png'), fullPage: true, animations: 'disabled' });
    const saved = page.waitForResponse(response => response.url().endsWith(`/admin/users/${target.id}`) && response.request().method() === 'PATCH');
    await editor.getByRole('button', { name: 'OK', exact: true }).click();
    assert.equal((await saved).status(), 200);
    await editor.waitFor({ state: 'hidden' });
    const details = await page.request.get(`${api}/admin/users/${target.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const updated = (await details.json()).user;
    assert.equal(updated.firstName, 'Updated');
    assert.equal(updated.phone, '6569876543');
    assert.equal(updated.personalAddress, 'Synthetic updated address');
    const rejected = await page.request.post(`${api}/login`, { data: { email, password: original } });
    assert.equal(rejected.status(), 401);
    const fresh = await page.request.post(`${api}/login`, { data: { email, password: replacement } });
    assert.equal(fresh.status(), 200);
    const expired = await page.request.get(`${api}/profile`, { headers: { Authorization: `Bearer ${oldToken}` } });
    assert.equal(expired.status(), 401);
  } finally {
    await browser.close();
  }
});
