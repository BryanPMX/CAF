// Start the synthetic Go preview and portal as documented in testing/README.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const portal = 'http://127.0.0.1:3100';
const api = 'http://localhost:8080/api/v1';
const artifacts = process.env.CAF_E2E_ARTIFACT_DIR || '/tmp/caf-rbac-e2e';

for (const role of ['admin', 'executive_director']) {
  test(`${role}: login, dashboard scope, navigation and user role choices`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    try {
      await page.goto(`${portal}/login`);
      await page.getByLabel('Correo electrónico', { exact: true }).fill(role === 'admin' ? 'a@example.test' : 'ceo@example.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.waitForURL(`${portal}/`);
      await page.getByRole('heading', { name: /Panel de Control/i }).waitFor();
      const executive = role === 'executive_director';
      assert.equal(await page.getByRole('menuitem', { name: /Sitio Web/ }).count(), executive ? 1 : 0);
      if (executive) {
        await page.getByText('Director Ejecutivo', { exact: true }).first().waitFor();
        await page.getByRole('combobox', { name: 'Filtrar por oficina' }).waitFor();
      } else {
        await page.getByRole('menuitem', { name: /Mi Oficina/ }).waitFor();
        await page.getByText('Oficina asignada', { exact: true }).waitFor();
        assert.equal(await page.getByRole('combobox', { name: 'Filtrar por oficina' }).count(), 0);
      }
      await fs.mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, `${role}-dashboard.png`), fullPage: true });

      // The request uses the real login JWT against the isolated Go handlers.
      const token = await page.evaluate(() => localStorage.getItem('authToken'));
      const headers = { Authorization: `Bearer ${token}` };
      const cases = await page.request.get(`${api}/admin/cases`, { headers });
      assert.equal(cases.status(), 200);
      assert.equal((await cases.json()).data.length, executive ? 2 : 1);
      const website = await page.request.get(`${api}/admin/site-content`, { headers });
      assert.equal(website.status(), executive ? 200 : 403);

      await page.getByRole('menuitem', { name: /Usuarios/ }).click();
      await page.getByRole('button', { name: /Crear Usuario/ }).click();
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Rol', { exact: true }).click();
      assert.equal(await page.getByRole('option', { name: 'Director Ejecutivo', exact: true }).count(), executive ? 1 : 0);
      await page.keyboard.press('Escape');
      await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
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
