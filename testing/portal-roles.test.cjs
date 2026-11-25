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
  new Function('require', 'exports', compiled)((name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('./') ? load(path.join(path.dirname(relativePath), name + '.ts')) : portalRequire(name), result);
  return result;
}
const roles = load('config/roles.ts');
const endpoints = load('app/lib/api-endpoints.ts');
const core = load('core/config.ts');

test('executives and technical support have organization and website access', () => {
  for (const role of Object.values(roles.USER_ROLES)) {
    const executive = ['technical_support', 'executive_director'].includes(role);
    assert.equal(roles.canAccessAllOffices(role), executive, role);
    assert.equal(core.canAccessAllOffices(role), executive, role);
    assert.equal(roles.canManageWebContent(role), executive, role);
    assert.equal(roles.getNavigationItemsForRole(role).some(item => item.key === 'web-content'), executive, role);
    assert.equal(roles.PERMISSIONS[role].includes('*'), executive, role);
    for (const key of ['maquilas', 'constructoras', 'properties']) {
      assert.equal(roles.getNavigationItemsForRole(role).some(item => item.key === key), ['admin','executive_director','technical_support'].includes(role), role);
    }
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
  assert.equal(navigation.find(item => item.key === 'offices').label, 'Oficinas');
  for (const role of ['technical_support','executive_director','admin']) {
    assert.equal(endpoints.getEndpointGroup(role), 'admin');
    assert.equal(endpoints.getCasesEndpoint(role, 'create'), '/admin/cases');
    assert.equal(endpoints.getAppointmentsEndpoint(role, 'create'), '/admin/appointments');
    assert.equal(roles.isManagementRole(role), true);
    assert.equal(roles.canViewDocumentType(role, 'legal'), true);
  }
  assert.throws(() => endpoints.getEndpointGroup('office_manager'), /Rol no válido/);
  assert.equal(roles.isValidRole('office_manager'), false);
  assert.deepEqual(roles.getAssignableRoles('office_manager'), []);
  assert.equal(roles.getAllRoles().some(role => role.value === 'office_manager'), false);
  assert.equal(endpoints.getEndpointGroup('psychologist'), 'staff');
});

test('management of a user depends on the actor and the target account', () => {
  const executive = { role: 'executive_director', officeId: 1 };
  const admin = { role: 'admin', officeId: 1 };
  const manager = { role: 'office_manager', officeId: 1 };
  const employee = { role: 'lawyer', officeId: 1 };
  assert.equal(roles.canManageUser(admin, executive), false);
  assert.equal(roles.canManageUser(manager, executive), false);
  assert.equal(roles.canManageUser(manager, admin), false);
  assert.equal(roles.canManageUser(admin, employee), true);
  assert.equal(roles.canManageUser(admin, {role: 'client', clientType: 'organization', officeId: null}), true);
  assert.equal(roles.canManageUser(admin, {role: 'client', officeId: null}), false);
  assert.equal(roles.canManageUser(manager, employee), false);
  assert.equal(roles.canManageUser(admin, { ...employee, officeId: 2 }), false);
  assert.equal(roles.canManageUser({ role: 'admin' }, employee), false);
  assert.equal(roles.canManageUser(employee, admin), false);
  assert.equal(roles.canManageUser(null, executive), false);
  assert.equal(roles.canManageUser(admin, null), false);
  assert.equal(roles.canManageUser(executive, executive), true);
  assert.equal(roles.canManageUser(executive, { ...employee, officeId: 2 }), true);
});


test('technical support is protected and alone can reset passwords', () => {
  const support = { role: 'technical_support' };
  for (const role of Object.values(roles.USER_ROLES)) {
    assert.equal(roles.canResetPasswords(role), role === 'technical_support');
    assert.equal(roles.canManageUser({ role, officeId: 1 }, support), role === 'technical_support');
    assert.equal(roles.getAssignableRoles(role).some(option => option.value === 'technical_support'), false);
  }
  assert.equal(roles.requiresOffice(support.role), false);
  assert.equal(roles.getRoleDisplayName(support.role), 'Soporte Tecnico');
  assert.equal(roles.canManageUser(support, { role: 'executive_director' }), true);
  assert.deepEqual(roles.getAssignableRoles(support.role, support.role).map(option => option.value), ['technical_support']);
});


test('optional password changes preserve blank fields and validate supplied credentials', async () => {
  const validation = load('core/validation.ts');
  await validation.createStrongPasswordFormRule(false)(null, '');
  await validation.createStrongPasswordFormRule(false)(null, undefined);
  await validation.createStrongPasswordFormRule(false)(null, 'Synthetic-Secure-Password123!');
  await assert.rejects(validation.createStrongPasswordFormRule()(null, ''));
  await assert.rejects(validation.createStrongPasswordFormRule(false)(null, 'weak'));
  await assert.rejects(validation.createStrongPasswordFormRule(false)(null, 'Strong-Password123!' + 'á'.repeat(30)));
  assert.deepEqual(roles.getAssignableRoles('client'), []);
  assert.deepEqual(roles.getAssignableRoles('unknown'), []);
});


test('profile helpers handle missing dates, names and safe photo links', () => {
  const profile = load('app/lib/profile.ts');
  assert.equal(profile.getProfileName({ firstName: ' Ana ', lastName: ' Pérez ' }), 'Ana Pérez');
  assert.equal(profile.getProfileInitials({ firstName: ' Ana ', lastName: ' Pérez ' }), 'AP');
  assert.equal(profile.getProfileInitials({ firstName: '', lastName: '' }), '');
  for (const value of [undefined, null, '', 'invalid', '0001-01-01T00:00:00Z']) assert.equal(profile.formatProfileDate(value), null);
  assert.ok(profile.formatProfileDate('2024-03-15T12:00:00Z').includes('2024'));
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAA', 'https://', '/api/avatar']) assert.equal(profile.isValidProfilePhotoURL(url), false);
  for (const url of ['https://example.test/photo.png', 'http://a.co']) assert.equal(profile.isValidProfilePhotoURL(url), true);
});

test('client age changes on the birthday and rejects impossible or future dates',()=>{
 const {ageFromBirthDate}=load('app/lib/profile.ts');
 const now=new Date(2026,10,24,12);
 assert.equal(ageFromBirthDate('1980-11-24',now),46);
 assert.equal(ageFromBirthDate('1980-11-25',now),45);
 assert.equal(ageFromBirthDate('1980-11-23',now),46);
 assert.equal(ageFromBirthDate('2000-02-29',new Date(2025,1,28,12)),24);
 assert.equal(ageFromBirthDate('2000-02-29',new Date(2025,2,1,12)),25);
 for(const value of [null,undefined,'','invalid','2026-02-31','2999-01-01'])assert.equal(ageFromBirthDate(value,now),null);
});
