// Run with: node --test testing/appointment-availability.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const portalRequire = createRequire(path.resolve(__dirname, '../admin-portal/package.json'));
const ts = portalRequire('typescript');
const dayjs = portalRequire('dayjs');
function loadPortalModule(relativePath) {
 const source = fs.readFileSync(path.resolve(__dirname, '../admin-portal/src', relativePath), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
 const exportsObject = {};
 new Function('require', 'exports', compiled)((name) => {
  if (name === '@/app/lib/api') return { apiClient: {} };
  if (name.startsWith('@/')) return loadPortalModule(name.slice(2) + '.ts');
  return portalRequire(name);
 }, exportsObject);
 return exportsObject;
}
const { availableAppointmentSlots: slots } = loadPortalModule('services/appointmentAvailability.ts');
const { withinSchedulingHours: within, defaultInternalRange } = loadPortalModule('app/lib/schedulingHours.ts');
const day = dayjs('2030-01-07T00:00:00'); // Monday, local time
const now = day.subtract(1, 'day');
const times = (duration, busy = []) => slots(day, duration, busy, now).map((slot) => slot.format('HH:mm'));

test('working hours contain a full duration and exclude Sundays and past times', () => {
 assert.equal(times(60)[0], '09:00');
 assert.equal(times(60).at(-1), '17:00');
 assert.equal(times(120).at(-1), '16:00');
 assert.deepEqual(slots(day.subtract(1, 'day'), 60, [], now), []);
 assert.deepEqual(slots(day, 60, [], day.hour(18)), []);
 assert.deepEqual(slots(day, 17, [], now), []);
});
test('Saturday client appointments start at 08:00 and finish by 15:00', () => {
 const saturday = day.add(5,'day');
 const available = slots(saturday,60,[],now).map((slot) => slot.format('HH:mm'));
 assert.equal(available[0], '08:00');
 assert.equal(available.at(-1), '14:00');
 assert.equal(slots(saturday,120,[],now).at(-1).format('HH:mm'), '13:00');
});
test('client and internal schedules remain separate with exact closing boundaries', () => {
 assert.equal(within(day.hour(7),day.hour(8),'client'),false);
 assert.equal(within(day.hour(7),day.hour(8),'internal'),true);
 assert.equal(within(day.hour(19),day.hour(20),'internal'),true);
 assert.equal(within(day.hour(19),day.hour(20).minute(1),'internal'),false);
 const saturday = day.add(5,'day');
 for(const kind of ['client','internal']) {
  assert.equal(within(saturday.hour(8),saturday.hour(15),kind),true);
  assert.equal(within(saturday.hour(7),saturday.hour(8),kind),false);
  assert.equal(within(saturday.hour(14),saturday.hour(15).minute(1),kind),false);
  assert.equal(within(saturday.add(1,'day').hour(10),saturday.add(1,'day').hour(11),kind),false);
  assert.equal(within(day.hour(19),day.add(1,'day').hour(8),kind),false);
 }
});
test('default meetings move forward without skipping the next working day', () => {
 for(const [date,nowValue,expected] of [
  [day,day.hour(23).minute(45),'2030-01-08 07:00'],
  [day.add(5,'day'),day.add(5,'day').hour(14).minute(30),'2030-01-14 07:00'],
  [day.add(5,'day'),now,'2030-01-12 08:00'],
 ]) {
  const [start,end] = defaultInternalRange(date,nowValue);
  assert.equal(start.format('YYYY-MM-DD HH:mm'),expected);
  assert.ok(within(start,end,'internal'));
 }
});
test('overlap excludes partially intersecting slots and allows adjacent bookings', () => {
 const busy = [{startTime:day.hour(10).toISOString(),endTime:day.hour(11).toISOString()}];
 const available = times(60,busy);
 assert.ok(available.includes('09:00'));
 assert.ok(!available.includes('09:30'));
 assert.ok(!available.includes('10:00'));
 assert.ok(!available.includes('10:30'));
 assert.ok(available.includes('11:00'));
});
test('fully occupied days and cross-midnight meetings have no leaking slots', () => {
 assert.deepEqual(times(60,[{startTime:day.subtract(1,'day').toISOString(),endTime:day.add(1,'day').toISOString()}]),[]);
 const busy=[{startTime:day.hour(8).toISOString(),endTime:day.hour(10).toISOString()}];
 assert.equal(times(60,busy)[0],'10:00');
});
