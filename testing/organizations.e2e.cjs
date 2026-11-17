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
  await field.press("ArrowDown");
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
    assert.equal(await modal.getByLabel('Oficina responsable', { exact: true }).count(), 0);
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
    assert.equal(await modal.getByLabel('Oficina responsable', { exact: true }).count(), 0);
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
    // Select a future working date, independent of the test machine's clock.
    await modal.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
    await modal.locator('.ant-picker-calendar .ant-picker-cell-in-view:not(.ant-picker-cell-disabled)').first().click();
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

test('only management can open either directory; staff keep minimal workflow selectors', { timeout: 90000 }, async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const email of ['lawyer@example.test','psychologist@example.test','receptionist@example.test','event_coordinator@example.test','client@example.test']) {
   const page = await browser.newPage({viewport:{width:390,height:844}});
   const headers = await login(page,email);
   for (const kind of ['maquila','constructora']) {
    const title = kind === 'maquila' ? 'Maquilas' : 'Constructoras';
    assert.equal(await page.getByRole('menuitem',{name:new RegExp(title)}).count(),0);
    await page.goto(`${portal}/app/${kind === 'maquila' ? 'maquilas' : 'constructoras'}`);
    await page.getByText('No tiene acceso a este directorio.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:`Registrar ${kind}`,exact:true}).count(),0);
    const response=await page.request.get(`${api}/organizations?kind=${kind}`,{headers});
    assert.equal(response.status(),403);
   }
   const options=await page.request.get(`${api}/maquila-options`,{headers});
   assert.equal(options.status(),email === 'client@example.test' ? 403 : 200);
   if (options.status()===200) for (const option of (await options.json()).data) assert.deepEqual(Object.keys(option).sort(),['id','name']);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
   await page.close();
  }
 } finally {await browser.close();}
});

test('one shared maquila serves two offices without exposing their clients or cases', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  let otherPage, executivePage;
  try {
    const headersA = await login(page);
    const password = 'Synthetic-E2E-Password123!';
    const otherLogin = await page.request.post(`${api}/login`, { data: { email: 'b@example.test', password } });
    assert.equal(otherLogin.status(), 200);
    const headersB = { Authorization: `Bearer ${(await otherLogin.json()).token}` };
    const suffix = Date.now();
    const factoryName = `Shared factory ${suffix}`;
    const registered = await page.request.post(`${api}/organizations`, { headers: headersA, data: { kind: 'maquila', name: factoryName } });
    assert.equal(registered.status(), 201);
    const factory = await registered.json();
    assert.equal(factory.officeId, null);
    for (const [officeId, headers, letter] of [[1, headersA, 'A'], [2, headersB, 'B']]) {
      const result = await page.request.post(`${api}/admin/users`, { headers, data: { firstName: `Employee ${letter}`, lastName: `${suffix}`, email: `shared-${letter}-${suffix}@example.test`, phone: '6561234567', password, officeId, role: 'client', employment: { maquilaId: factory.id, employeeNumber: `000${officeId}`, shiftName: 'Segundo turno' } } });
      assert.equal(result.status(), 201, await result.text());
      const person = await result.json();
      const caseResponse = await page.request.post(`${api}/admin/cases`, { headers, data: { clientId: person.id, officeId, title: `Case ${letter} ${suffix}`, category: 'Legal', description: 'Shared employer, independent office case' } });
      assert.equal(caseResponse.status(), 201, await caseResponse.text());
    }
    otherPage = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    await login(otherPage, 'b@example.test');
    await otherPage.goto(`${portal}/app/maquilas?organizationId=${factory.id}`);
    const drawerB = otherPage.locator('.ant-drawer-content');
    await drawerB.getByRole('tab', { name: 'Clientes y contactos', exact: true }).click();
    await drawerB.getByText(`Employee B ${suffix}`, { exact: true }).waitFor();
    assert.equal(await drawerB.getByText(`Employee A ${suffix}`, { exact: true }).count(), 0);
    await drawerB.getByRole('tab', { name: 'Expedientes', exact: true }).click();
    await drawerB.getByRole('button', { name: `Case B ${suffix}`, exact: true }).waitFor();
    assert.equal(await drawerB.getByRole('button', { name: `Case A ${suffix}`, exact: true }).count(), 0);
    await fs.mkdir(artifacts, { recursive: true });
    await otherPage.screenshot({ path: `${artifacts}/shared-factory-office-b.png`, fullPage: true, animations: 'disabled' });
    executivePage = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    await login(executivePage, 'ceo@example.test');
    await executivePage.goto(`${portal}/app/maquilas?organizationId=${factory.id}`);
    const globalDrawer = executivePage.locator('.ant-drawer-content');
    await globalDrawer.getByRole('tab', { name: 'Clientes y contactos', exact: true }).click();
    await globalDrawer.getByText(`Employee A ${suffix}`, { exact: true }).waitFor();
    await globalDrawer.getByText(`Employee B ${suffix}`, { exact: true }).waitFor();
    await globalDrawer.getByText('Office A', { exact: true }).waitFor();
    await globalDrawer.getByText('Office B', { exact: true }).waitFor();
    await executivePage.screenshot({ path: `${artifacts}/shared-factory-executive.png`, fullPage: true, animations: 'disabled' });
  } finally { await browser.close(); }
});

test('shared contractor keeps per-office contacts and appointments with an explicit global office picker', {timeout:120000}, async () => {
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 let otherPage, globalPage;
 try {
  const headers=await login(page);
  const suffix=Date.now();
  const name=`Shared company ${suffix}`;
  const registered=await page.request.post(`${api}/organizations`,{headers,data:{kind:'constructora',name,legalRepresentative:'Legal representative',legalAddress:'Avenida Compartida 123',boardPresident:'President',neighborhood:'Centro'}});
  assert.equal(registered.status(),201,await registered.text());
  const company=await registered.json();
  assert.equal(company.officeId,null);
  otherPage=await browser.newPage({viewport:{width:390,height:844}});
  const headersB=await login(otherPage,'b@example.test');
  for (const [officeId, auth, letter] of [[1,headers,'A'],[2,headersB,'B']]) {
   const created=await page.request.post(`${api}/admin/users`,{headers:auth,data:{firstName:`Contact ${letter}`,lastName:`${suffix}`,email:`company-contact-${letter}-${suffix}@example.test`,phone:'6561234567',password:'Synthetic-E2E-Password123!',role:'client',officeId}});
   assert.equal(created.status(),201,await created.text());
   const person=await created.json();
   const linked=await page.request.post(`${api}/organizations/${company.id}/clients`,{headers:auth,data:{clientId:person.id}});
   assert.equal(linked.status(),200,await linked.text());
  }
  await otherPage.goto(`${portal}/app/constructoras?organizationId=${company.id}`);
  const drawer=otherPage.locator('.ant-drawer-content');
  await drawer.getByText('Avenida Compartida 123',{exact:true}).waitFor();
  await drawer.getByRole('tab',{name:'Clientes y contactos',exact:true}).click();
  await drawer.getByText(`Contact B ${suffix}`,{exact:true}).waitFor();
  assert.equal(await drawer.getByText(`Contact A ${suffix}`,{exact:true}).count(),0);
  assert.equal(await drawer.getByRole('tab',{name:'Expedientes',exact:true}).count(),0);
  await fs.mkdir(artifacts,{recursive:true});
  await otherPage.screenshot({path:`${artifacts}/shared-company-mobile.png`,fullPage:true,animations:'disabled'});
  async function book(target, officeName, title) {
   const directory=target.locator('.ant-drawer-content');
   await directory.getByRole('button',{name:'Agendar cita',exact:true}).click();
   const modal=target.getByRole('dialog').filter({hasText:'Cita para constructora'});
   if (officeName) await select(target,modal.getByLabel('Oficina responsable',{exact:true}),officeName);
   await modal.getByLabel('Título de la cita',{exact:true}).fill(title);
   await select(target,modal.getByLabel('Asignar a',{exact:true}),'Admin B CAF');
   await modal.getByRole('button',{name:'Mes siguiente',exact:true}).click();
   await modal.locator('.ant-picker-calendar .ant-picker-cell-in-view:not(.ant-picker-cell-disabled)').first().click();
   await modal.getByRole('group',{name:'Horarios disponibles',exact:true}).getByRole('button').first().click();
   const saved=target.waitForResponse(r=>r.url().endsWith('/admin/appointments') && r.request().method()==='POST');
   await modal.getByRole('button',{name:'Guardar',exact:true}).click();
   const result=await saved;
   assert.equal(result.status(),201,await result.text());
   const appointment=await result.json();
   assert.equal(appointment.clientId,company.accountClientId);
   assert.equal(appointment.officeId,2);
   assert.equal(appointment.caseId,0);
   await modal.waitFor({state:'hidden'});
  }
  await book(otherPage,null,`Office B company meeting ${suffix}`);
  globalPage=await browser.newPage({viewport:{width:1440,height:1050}});
  await login(globalPage,'ceo@example.test');
  await globalPage.goto(`${portal}/app/constructoras?organizationId=${company.id}`);
  const globalDrawer=globalPage.locator('.ant-drawer-content');
  await globalDrawer.getByText('Avenida Compartida 123',{exact:true}).waitFor();
  await book(globalPage,'Office B',`CEO company meeting ${suffix}`);
  await globalDrawer.getByRole('tab',{name:'Clientes y contactos',exact:true}).click();
  await globalDrawer.getByText(`Contact A ${suffix}`,{exact:true}).waitFor();
  await globalDrawer.getByText(`Contact B ${suffix}`,{exact:true}).waitFor();
  await globalPage.screenshot({path:`${artifacts}/shared-company-executive.png`,fullPage:true,animations:'disabled'});
  const listA=await page.request.get(`${api}/admin/appointments?clientId=${company.accountClientId}`,{headers});
  const listB=await otherPage.request.get(`${api}/admin/appointments?clientId=${company.accountClientId}`,{headers:headersB});
  assert.equal((await listA.json()).data.length,0);
  assert.equal((await listB.json()).data.length,2);
  await otherPage.goto(`${portal}/app/users?edit=${company.accountClientId}`);
  const editor=otherPage.getByRole('dialog').filter({hasText:'Editar Usuario'});
  await editor.waitFor();
  assert.equal(await editor.getByLabel('Oficina',{exact:true}).count(),0);
  const changed=`${name} updated`;
  await editor.getByLabel('Nombre(s)',{exact:true}).fill(changed);
  const edited=otherPage.waitForResponse(r=>r.url().endsWith(`/admin/users/${company.accountClientId}`) && r.request().method()==='PATCH');
  await editor.getByRole('button',{name:'OK',exact:true}).click();
  const result=await edited;
  assert.equal(result.status(),200,await result.text());
  const canonical=await result.json();
  assert.equal(canonical.officeId ?? null,null);
  await otherPage.goto(`${portal}/app/users/${company.accountClientId}`);
  await otherPage.getByText('Registro de constructora compartido entre oficinas',{exact:true}).waitFor();
  assert.equal(await otherPage.getByText('Sin oficina asignada',{exact:true}).count(),0);
 } catch(error) {
  await fs.mkdir(artifacts,{recursive:true});
  if (globalPage) await globalPage.screenshot({path:`${artifacts}/shared-company-failure.png`,fullPage:true});
  throw error;
 } finally {await browser.close();}
});
