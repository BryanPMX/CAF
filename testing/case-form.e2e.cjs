// Run only against the synthetic loopback preview described in README.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('playwright/test');
const fs = require('node:fs/promises');
const portal = 'http://127.0.0.1:3100';
const api = 'http://localhost:8080/api/v1';
const artifacts =
  process.env.CAF_CASE_FORM_ARTIFACT_DIR || '/tmp/caf-case-form-e2e';
const password = 'Synthetic-E2E-Password123!';

async function session(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${portal}/login`);
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('a@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.waitForURL(`${portal}/`);
  await page.goto(`${portal}/app/cases`);
  const headers = {
    Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('authToken'))}`,
  };
  await page.getByRole('button', { name: /Crear Caso/ }).click();
  const modal = page
    .getByRole('dialog')
    .filter({ hasText: 'Crear Nuevo Caso' });
  await modal.waitFor();
  return { page, modal, headers };
}

async function select(page, field, text) {
  await field.press('ArrowDown');
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: text })
    .click();
}

async function basics(page, modal) {
  await select(
    page,
    modal.getByLabel('Tipo de Caso', { exact: true }),
    /^Divorcios$/
  );
  await modal
    .getByLabel('Descripción Inicial', { exact: true })
    .fill('Apoyo familiar solicitado para pruebas sintéticas.');
}

async function save(page, modal) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/cases') && r.request().method() === 'POST'
  );
  await modal.getByRole('button', { name: /Crear Caso/ }).click();
  const saved = await response.catch(async (error) => {
    console.error(await modal.innerText());
    await fs.mkdir(artifacts, { recursive: true });
    await page.screenshot({
      path: `${artifacts}/save-failure.png`,
      fullPage: true,
    });
    throw error;
  });
  assert.equal(saved.status(), 201, await saved.text());
  await expect(modal).toBeHidden();
  return (await saved.json()).data;
}

async function client(page, headers, suffix, employment) {
  const response = await page.request.post(`${api}/admin/users`, {
    headers,
    data: {
      firstName: 'Cliente',
      lastName: `Formulario ${suffix}`,
      email: `existing-${suffix}@example.test`,
      phone: '6561234567',
      password,
      role: 'client',
      officeId: 1,
      employment,
    },
  });
  assert.equal(response.status(), 201, await response.text());
  return response.json();
}

async function chooseClient(page, modal, person) {
  await modal
    .getByLabel('Buscar Cliente por Nombre o Correo', { exact: true })
    .fill(person.email);
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: person.email })
    .click();
}

test(
  'new client: responsive groups, required employment, paired hours, zeroes and an overnight shift',
  { timeout: 120000 },
  async (t) => {
    const { page, modal, headers } = await session(t);
    const suffix = Date.now();
    const registered = await page.request.post(`${api}/organizations`, {
      headers,
      data: { kind: 'maquila', name: `Fábrica Formulario ${suffix}` },
    });
    assert.equal(registered.status(), 201);
    const factory = await registered.json();
    await modal
      .getByRole('radio', { name: 'Cliente Nuevo', exact: true })
      .check();
    await modal.getByLabel('Nombre(s)', { exact: true }).fill('Persona');
    await modal
      .getByLabel('Apellidos', { exact: true })
      .fill(`Formulario ${suffix}`);
    await modal
      .getByLabel('Correo Electrónico', { exact: true })
      .fill(`case-form-${suffix}@example.test`);
    await modal.getByLabel('Maquila', { exact: true }).fill(factory.name);
    await select(
      page,
      modal.getByLabel('Maquila', { exact: true }),
      factory.name
    );
    await basics(page, modal);
    await modal.getByRole('button', { name: /Crear Caso/ }).click();
    await expect(
      modal.locator('#employment_employeeNumber_help')
    ).toContainText('Este campo es obligatorio.');
    await expect(modal.locator('#employment_shiftName_help')).toContainText(
      'Este campo es obligatorio.'
    );
    await modal
      .getByLabel('Número de Empleado', { exact: true })
      .fill('000042');
    await modal.getByLabel('Turno', { exact: true }).fill('Tercer turno');
    await modal.getByLabel('Inicio del turno', { exact: true }).fill('22:00');
    await modal.getByRole('button', { name: /Crear Caso/ }).click();
    await expect(modal.locator('#employment_shiftEnd_help')).toContainText(
      'Este campo es obligatorio.'
    );
    // Both hours are optional together; clearing one revalidates the other.
    await modal.getByLabel('Inicio del turno', { exact: true }).fill('');
    await expect(modal.locator('#employment_shiftEnd_help')).toBeHidden();
    await modal.getByLabel('Inicio del turno', { exact: true }).fill('22:00');
    await modal.getByLabel('Fin del turno', { exact: true }).fill('06:00');
    await modal.getByLabel('Cuota/Precio', { exact: false }).fill('250');
    await modal
      .getByLabel('Número de Expediente', { exact: true })
      .fill('589-25');
    await modal.getByLabel('Juzgado', { exact: true }).fill('1FXA');
    await fs.mkdir(artifacts, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1400 });
    await modal
      .getByLabel('Nombre(s)', { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${artifacts}/case-form-overview.png`,
      fullPage: true,
      animations: 'disabled',
    });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await modal.evaluate((element) => {
        const body = element.querySelector('.ant-modal-body');
        const footer = element
          .querySelector('.ant-modal-footer')
          .getBoundingClientRect();
        const number = element
          .querySelector('#employment_employeeNumber')
          .getBoundingClientRect();
        const shift = element
          .querySelector('#employment_shiftName')
          .getBoundingClientRect();
        return {
          overflow: body.scrollWidth > body.clientWidth,
          bodyWidth: body.clientWidth,
          scrollWidth: body.scrollWidth,
          wide: [...body.querySelectorAll('*')]
            .filter(
              (el) =>
                el.getBoundingClientRect().right >
                body.getBoundingClientRect().right + 1
            )
            .slice(0, 8)
            .map((el) => ({
              tag: el.tagName,
              cls: el.className,
              width: el.getBoundingClientRect().width,
            })),
          footerBottom: footer.bottom,
          viewport: innerHeight,
          sameRow: Math.abs(number.top - shift.top) < 2,
        };
      });
      await page.screenshot({
        path: `${artifacts}/layout-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      assert.equal(
        metrics.overflow,
        false,
        `${width}px has horizontal overflow: ${JSON.stringify(metrics)}`
      );
      assert.ok(
        metrics.footerBottom <= metrics.viewport,
        `${width}px hides save actions`
      );
      assert.equal(
        metrics.sameRow,
        width >= 768,
        `${width}px has incorrect field stacking`
      );
      await modal
        .getByLabel('Nombre(s)', { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${artifacts}/new-case-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    const saved = await save(page, modal);
    assert.equal(saved.employeeNumber, '000042');
    assert.equal(saved.shiftStart, '22:00');
    assert.equal(saved.shiftEnd, '06:00');
    assert.equal(saved.maquilaId, factory.id);
    assert.equal(saved.officeId, 1);
    assert.equal(saved.category, 'Familiar');
    assert.equal(saved.fee, 250);
    assert.equal(saved.docketNumber, '589-25');
    const memberships = await page.request.get(
      `${api}/client-organizations/${saved.clientId}`,
      { headers }
    );
    assert.equal((await memberships.json()).data[0].employeeNumber, '000042');
  }
);

test(
  'existing client: copying employment preserves the client and clearing a selection prevents stale data',
  { timeout: 90000 },
  async (t) => {
    const { page, modal, headers } = await session(t);
    const suffix = Date.now();
    const registered = await page.request.post(`${api}/organizations`, {
      headers,
      data: { kind: 'maquila', name: `Fábrica Existente ${suffix}` },
    });
    const factory = await registered.json();
    const person = await client(page, headers, `${suffix}-a`, {
      maquilaId: factory.id,
      employeeNumber: '0009',
      shiftName: 'Primero',
    });
    await chooseClient(page, modal, person);
    await expect(
      modal.getByLabel('Número de Empleado', { exact: true })
    ).toHaveValue('0009');
    await modal.getByLabel('Número de Empleado', { exact: true }).fill('0010');
    await basics(page, modal);
    const saved = await save(page, modal);
    assert.equal(saved.employeeNumber, '0010');
    const memberships = await page.request.get(
      `${api}/client-organizations/${person.id}`,
      { headers }
    );
    assert.equal((await memberships.json()).data[0].employeeNumber, '0009');
    await page.getByRole('button', { name: /Crear Caso/ }).click();
    await chooseClient(page, modal, person);
    await expect(
      modal.getByLabel('Número de Empleado', { exact: true })
    ).toHaveValue('0009');
    await modal
      .getByLabel('Buscar Cliente por Nombre o Correo', { exact: true })
      .fill('Unselected person');
    await expect(
      modal.getByLabel('Número de Empleado', { exact: true })
    ).toHaveCount(0);
    await expect(modal.getByLabel('Maquila', { exact: true })).toBeDisabled();
    await basics(page, modal);
    await modal.getByRole('button', { name: /Crear Caso/ }).click();
    await expect(
      modal.getByText('Seleccione un cliente de la lista.', { exact: true })
    ).toBeVisible();
    const plain = await client(page, headers, `${suffix}-b`);
    await chooseClient(page, modal, plain);
    await expect(modal.getByLabel('Maquila', { exact: true })).toBeEnabled();
    const plainCase = await save(page, modal);
    assert.equal(plainCase.clientId, plain.id);
    assert.equal(plainCase.maquilaId ?? null, null);
    assert.equal(plainCase.employeeNumber || '', '');
  }
);

test(
  'employment and save errors stay actionable, retry works, and reopening resets the form',
  { timeout: 90000 },
  async (t) => {
    const { page, modal, headers } = await session(t);
    const person = await client(page, headers, `${Date.now()}-retry`);
    await page.route(`**/client-organizations/${person.id}`, (route) =>
      route.fulfill({ status: 503, json: { error: 'Synthetic failure' } })
    );
    await chooseClient(page, modal, person);
    await expect(
      modal.getByText('No se pudieron cargar los datos de maquila.', {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      modal.getByRole('button', { name: /Crear Caso/ })
    ).toBeDisabled();
    await page.unroute(`**/client-organizations/${person.id}`);
    await modal
      .getByRole('button', { name: 'Reintentar', exact: true })
      .click();
    await expect(
      modal.getByRole('button', { name: /Crear Caso/ })
    ).toBeEnabled();
    await basics(page, modal);
    await page.route('**/admin/cases', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 500,
            json: { error: 'No se pudo guardar la prueba.' },
          })
        : route.continue()
    );
    await modal.getByRole('button', { name: /Crear Caso/ }).click();
    await expect(
      modal.getByText('No se pudo guardar la prueba.', { exact: true })
    ).toBeVisible();
    await expect(
      modal.getByLabel('Descripción Inicial', { exact: true })
    ).toHaveValue('Apoyo familiar solicitado para pruebas sintéticas.');
    await page.unroute('**/admin/cases');
    await save(page, modal);
    await page.getByRole('button', { name: /Crear Caso/ }).click();
    await expect(
      modal.getByLabel('Buscar Cliente por Nombre o Correo', { exact: true })
    ).toHaveValue('');
    await expect(
      modal.getByLabel('Descripción Inicial', { exact: true })
    ).toHaveValue('');
    await expect(
      modal.getByText('No se pudo guardar la prueba.', { exact: true })
    ).toHaveCount(0);
  }
);
