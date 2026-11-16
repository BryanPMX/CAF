const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const portalRequire = createRequire(path.resolve(__dirname, '../admin-portal/package.json'));
const ts = portalRequire('typescript');

function load(relativePath) {
  const source = fs.readFileSync(path.resolve(__dirname, '../admin-portal/src', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const result = {};
  new Function('require', 'exports', compiled)((name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : portalRequire(name), result);
  return result;
}
const roles = load('config/roles.ts');
const endpoints = load('app/lib/api-endpoints.ts');
const core = load('core/config.ts');

test('only Director Ejecutivo has organization and website access', () => {
  for (const role of Object.values(roles.USER_ROLES)) {
    const executive = role === 'executive_director';
    assert.equal(roles.canAccessAllOffices(role), executive, role);
    assert.equal(core.canAccessAllOffices(role), executive, role);
    assert.equal(roles.canManageWebContent(role), executive, role);
    assert.equal(roles.getNavigationItemsForRole(role).some(item => item.key === 'web-content'), executive, role);
    assert.equal(roles.PERMISSIONS[role].includes('*'), executive, role);
  }
  assert.equal(roles.getRoleDisplayName('executive_director'), 'Director Ejecutivo');
  assert.equal(roles.requiresOffice('executive_director'), false);
  assert.equal(roles.requiresOffice('admin'), true);
  assert.equal(roles.canAccessAllOffices('unknown'), false);
});

test('office administrators retain their operational navigation and API workflows', () => {
  const navigation = roles.getNavigationItemsForRole('admin');
  for (const key of ['dashboard','cases','appointments','calendar','users','offices','records','reports']) {
    assert.ok(navigation.some(item => item.key === key), key);
  }
  assert.equal(navigation.find(item => item.key === 'offices').label, 'Mi Oficina');
  for (const role of ['executive_director','admin']) {
    assert.equal(endpoints.getEndpointGroup(role), 'admin');
    assert.equal(endpoints.getCasesEndpoint(role, 'create'), '/admin/cases');
    assert.equal(endpoints.getAppointmentsEndpoint(role, 'create'), '/admin/appointments');
    assert.equal(roles.isManagementRole(role), true);
    assert.equal(roles.canViewDocumentType(role, 'legal'), true);
  }
  assert.equal(endpoints.getEndpointGroup('office_manager'), 'manager');
  assert.equal(endpoints.getEndpointGroup('psychologist'), 'staff');
});
