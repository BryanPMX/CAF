// Uses the isolated Go preview documented in README.md, never production data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const portal = 'http://127.0.0.1:3100';
const api = 'http://localhost:8080/api/v1';
const artifacts = process.env.CAF_E2E_ARTIFACT_DIR || '/tmp/caf-organizations-e2e';
async function login(page, email = 'a@example.test') {
  await page.goto(`${portal}/login`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-E2E-Password123!');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.waitForURL(`${portal}/`);
  return { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('authToken'))}` };
}
async function select(page, field, name) {
  await field.click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: new RegExp(`^${name}$`) }).click();
}

test('office administrator: factories, historical cases, contractors, contacts, direct appointments and calendar', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    const headers = await login(page);
    const suffix = Date.now();
    const factory = `Maquila Frontera ${suffix}`;
    const company = `Constructora Centro ${suffix}`;
    const email = `employee-${suffix}@example.test`;
    const created = await page.request.post(`${api}/admin/users`, { headers, data: {
      firstName: 'Persona', lastName: `Maquila ${suffix}`, email, role: 'client', officeId: 1,
      phone: '6561234567', password: 'Synthetic-E2E-Password123!',
    } });
    assert.equal(created.status(), 201, await created.text());
    const client = await created.json();
    await page.getByRole('menuitem', { name: /Maquilas/ }).click();
    await page.getByRole('heading', { name: 'Maquilas', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Registrar maquila', exact: true }).click();
    let modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar', exact: true }) });
    await modal.getByLabel('Nombre', { exact: true }).fill(factory);
    assert.equal(await modal.getByLabel('Oficina responsable', { exact: true }).isDisabled(), true);
    const factorySaved = page.waitForResponse(r => r.url().endsWith('/organizations') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
    const factoryResponse = await factorySaved;
    assert.equal(factoryResponse.status(), 201, await factoryResponse.text());
    const organization = await factoryResponse.json();
    await modal.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: factory, exact: true }).click();
    const drawer = page.locator('.ant-drawer-content');
    await drawer.getByRole('button', { name: 'Vincular cliente', exact: true }).click();
    modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar', exact: true }) });
    await modal.getByLabel('Cliente', { exact: true }).fill(email);
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: `Persona Maquila ${suffix}` }).click();
    await modal.getByLabel('Número de Empleado', { exact: true }).fill('000042');
    await modal.getByLabel('Turno', { exact: true }).fill('Tercer turno');
    await modal.getByLabel('Inicio del turno', { exact: true }).fill('22:00');
    await modal.getByLabel('Fin del turno', { exact: true }).fill('06:00');
    const linked = page.waitForResponse(r => r.url().endsWith(`/organizations/${organization.id}/clients`) && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
    assert.equal((await linked).status(), 200);
    await modal.waitFor({ state: 'hidden' });
    await drawer.getByRole('tab', { name: 'Clientes y contactos', exact: true }).click();
    await drawer.getByText('000042', { exact: true }).waitFor();
    await drawer.getByRole('button', { name: 'Crear expediente', exact: true }).click();
    modal = page.getByRole('dialog').filter({ hasText: 'Crear Nuevo Caso' });
    assert.equal(await modal.getByLabel('Número de Empleado', { exact: true }).inputValue(), '000042');
    await modal.getByLabel('Tipo de Caso', { exact: true }).click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: /^Divorcios$/ }).click();
    await modal.getByLabel('Descripción Inicial', { exact: true }).fill('Expediente sintético de maquila');
    const caseSaved = page.waitForResponse(r => r.url().endsWith('/admin/cases') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: /Crear Caso|OK/, exact: true }).click();
    const caseResponse = await caseSaved;
    assert.equal(caseResponse.status(), 201, await caseResponse.text());
    await modal.waitFor({ state: 'hidden' });
    await drawer.getByRole('tab', { name: 'Expedientes', exact: true }).click();
    await drawer.getByText('Divorcios', { exact: true }).waitFor();
    await fs.mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: `${artifacts}/factory-cases.png`, fullPage: true, animations: 'disabled' });
    const moved = await page.request.patch(`${api}/admin/users/${client.id}`, { headers, data: { ...client, employment: { maquilaId: null } } });
    assert.equal(moved.status(), 200, await moved.text());
    const history = await page.request.get(`${api}/organizations/${organization.id}`, { headers });
    const historical = await history.json();
    assert.equal(historical.cases[0].employeeNumber, '000042');
    assert.equal(historical.clients[0].historical, true);
    const caseID = historical.cases[0].id;
    await page.goto(`${portal}/app/cases/${caseID}`);
    await page.getByRole('button', { name: /Editar Caso/ }).click();
    modal = page.getByRole('dialog').filter({ hasText: 'Editar Caso' });
    await modal.getByLabel('Número de Empleado', { exact: true }).fill('000043');
    const edited = page.waitForResponse(r => r.url().endsWith(`/admin/cases/${caseID}`) && r.request().method() === 'PUT');
    await modal.getByRole('button', { name: /Guardar Cambios/ }).click();
    assert.equal((await edited).status(), 200);
    await modal.waitFor({ state: 'hidden' });
    const afterEdit = await page.request.get(`${api}/organizations/${organization.id}`, { headers });
    assert.equal((await afterEdit.json()).cases[0].employeeNumber, '000043');
    const currentLinks = await page.request.get(`${api}/client-organizations/${client.id}`, { headers });
    assert.deepEqual((await currentLinks.json()).data, []);


    await page.goto(`${portal}/app/constructoras`);
    await page.getByRole('button', { name: 'Registrar constructora', exact: true }).click();
    modal = page.getByRole('dialog');
    for (const [label, value] of Object.entries({ Nombre: company, 'Apoderado legal': 'Representante Sintético', 'Domicilio legal': 'Avenida Prueba 123', 'Presidente del Consejo': 'Presidente Sintético', 'Nombre de la colonia': 'Centro' })) {
      await modal.getByLabel(label, { exact: true }).fill(value);
    }
    const companySaved = page.waitForResponse(r => r.url().endsWith('/organizations') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
    const companyResponse = await companySaved;
    assert.equal(companyResponse.status(), 201, await companyResponse.text());
    const contractor = await companyResponse.json();
    await modal.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: company, exact: true }).click();
    await drawer.getByText('Avenida Prueba 123', { exact: true }).waitFor();
    await drawer.getByRole('button', { name: 'Vincular cliente', exact: true }).click();
    modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar', exact: true }) });
    await modal.getByLabel('Cliente', { exact: true }).fill(email);
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: `Persona Maquila ${suffix}` }).click();
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await drawer.getByRole('button', { name: 'Agendar cita', exact: true }).click();
    modal = page.getByRole('dialog').filter({ hasText: 'Cita para constructora' });
    await modal.getByLabel('Título de la cita', { exact: true }).fill(`Reunión ${suffix}`);
    await select(page, modal.getByLabel('Asignar a', { exact: true }), 'Admin A CAF');
    await modal.getByRole('group', { name: 'Horarios disponibles', exact: true }).getByRole('button').first().click();
    const appointmentSaved = page.waitForResponse(r => r.url().endsWith('/admin/appointments') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
    const appointmentResponse = await appointmentSaved;
    assert.equal(appointmentResponse.status(), 201, await appointmentResponse.text());
    const appointment = await appointmentResponse.json();
    assert.equal(appointment.caseId, 0);
    assert.equal(appointment.clientId, contractor.accountClientId);
    await modal.waitFor({ state: 'hidden' });
    await drawer.getByRole('tab', { name: 'Clientes y contactos', exact: true }).click();
    const companyRow = drawer.getByRole('row').filter({ hasText: company });
    await companyRow.getByRole('button', { name: 'Crear evento', exact: true }).click();
    modal = page.getByRole('dialog').filter({ hasText: 'Nuevo evento interno' });
    await modal.getByLabel('Título', { exact: true }).fill(`Evento ${suffix}`);
    const eventSaved = page.waitForResponse(r => r.url().endsWith('/calendar/events') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Crear evento', exact: true }).click();
    const eventResponse = await eventSaved;
    assert.equal(eventResponse.status(), 201, await eventResponse.text());
    const event = await eventResponse.json();
    assert.deepEqual(event.relatedClients.map(link => link.clientId), [contractor.accountClientId]);
    assert.ok(!event.attendees.some(attendee => attendee.userId === contractor.accountClientId));
    await modal.waitFor({ state: 'hidden' });
    await page.screenshot({ path: `${artifacts}/contractor-contacts.png`, fullPage: true, animations: 'disabled' });
    await companyRow.getByRole('button', { name: 'Ver citas', exact: true }).click();
    await page.getByRole('row').filter({ hasText: `Reunión ${suffix}` }).getByText(company, { exact: true }).waitFor();
    await page.screenshot({ path: `${artifacts}/company-appointment.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('row').filter({ hasText: `Reunión ${suffix}` }).getByRole('button', { name: 'Editar Cita', exact: true }).click();
    modal = page.getByRole('dialog').filter({ hasText: 'Editar Cita' });
    await modal.getByLabel('Título de la Cita', { exact: true }).fill(`Reunión actualizada ${suffix}`);
    const appointmentEdited = page.waitForResponse(r => r.url().endsWith(`/admin/appointments/${appointment.id}`) && r.request().method() === 'PATCH');
    await modal.getByRole('button', { name: /Guardar Cambios/ }).click();
    const editResponse = await appointmentEdited;
    assert.equal(editResponse.status(), 200, await editResponse.text());
    await modal.waitFor({ state: 'hidden' });
    await page.getByRole('row').filter({ hasText: `Reunión actualizada ${suffix}` }).waitFor();

    await page.goto(`${portal}/app/users`);
    await page.locator(`tr[data-row-key="${contractor.accountClientId}"]`).waitFor();
    assert.deepEqual(errors, []);
  } catch (error) {
    await fs.mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
    throw error;
  } finally { await browser.close(); }
});

test('staff directory is read-only, scoped, and fits a narrow screen', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    const headers = await login(page, 'lawyer@example.test');
    const loaded = page.waitForResponse(r => r.url().includes('/organizations?kind=maquila'));
    await page.goto(`${portal}/app/maquilas`);
    assert.equal((await loaded).status(), 200);
    await page.getByRole('button', { name: /Maquila Frontera/ }).first().waitFor();
    await page.getByRole('heading', { name: 'Maquilas', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Registrar maquila', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const denied = await page.request.post(`${api}/organizations`, { headers, data: { kind: 'maquila', name: 'Denied', officeId: 1 } });
    assert.equal(denied.status(), 403);
    await fs.mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: `${artifacts}/staff-mobile.png`, fullPage: true, animations: 'disabled' });
  } finally { await browser.close(); }
});
