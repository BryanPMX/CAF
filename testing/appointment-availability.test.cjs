// Run with: node --test testing/appointment-availability.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const portalRequire = createRequire(path.resolve(__dirname, '../admin-portal/package.json'));
const ts = portalRequire('typescript');
const dayjs = portalRequire('dayjs');
const source = fs.readFileSync(path.resolve(__dirname, '../admin-portal/src/services/appointmentAvailability.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exportsObject = {};
new Function('require', 'exports', compiled)((name) => name === '@/app/lib/api' ? { apiClient: {} } : portalRequire(name), exportsObject);
const { availableAppointmentSlots: slots } = exportsObject;
const day = dayjs('2030-01-07T00:00:00'); // Monday, local time
const now = day.subtract(1, 'day');
const times = (duration, busy = []) => slots(day, duration, busy, now).map((slot) => slot.format('HH:mm'));

test('working hours contain a full duration and exclude weekends and past times', () => {
 assert.equal(times(60)[0], '09:00');
 assert.equal(times(60).at(-1), '17:00');
 assert.equal(times(120).at(-1), '16:00');
 assert.deepEqual(slots(day.subtract(1, 'day'), 60, [], now), []);
 assert.deepEqual(slots(day, 60, [], day.hour(18)), []);
 assert.deepEqual(slots(day, 17, [], now), []);
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
