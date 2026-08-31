'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PinSchedule = require('../js/pin-schedule.js');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const atJst = value => new Date(`${value}+09:00`);

assert.equal(PinSchedule.isDayMeeting('15:00'), true);
assert.equal(PinSchedule.isDayMeeting('15:01'), false);

assert.equal(PinSchedule.isFinished('2026-08-31', '15:00', atJst('2026-08-31T14:59:00')), false);
assert.equal(PinSchedule.isFinished('2026-08-31', '15:00', atJst('2026-08-31T15:00:00')), true);
assert.equal(PinSchedule.isFinished('2026-08-31', '', atJst('2026-08-31T23:00:00')), false);

const venue = {
  meetings: [
    { next_date: '2026-08-31', next_date_2: '2026-09-07', start_time: '13:00', end_time: '15:00' },
    { next_date: '2026-08-31', next_date_2: '2026-09-01', start_time: '18:00', end_time: '20:00' }
  ]
};
const afterDayMeeting = PinSchedule.selectVenueOccurrence(venue, atJst('2026-08-31T15:00:00'));
assert.equal(afterDayMeeting.date, '2026-08-31');
assert.equal(afterDayMeeting.start_time, '18:00');

const afterAllToday = PinSchedule.selectVenueOccurrence(venue, atJst('2026-08-31T20:00:00'));
assert.equal(afterAllToday.date, '2026-09-01');

const cancelled = {
  meetings: [{
    next_date: '2026-08-31', next_date_2: '2026-09-07',
    start_time: '13:00', end_time: '15:00', has_exception: true, exc_type: 'cancel'
  }]
};
assert.equal(
  PinSchedule.selectVenueOccurrence(cancelled, atJst('2026-08-31T10:00:00')).date,
  '2026-09-07'
);
const cancelledEffective = PinSchedule.withEffectiveOccurrence(cancelled, atJst('2026-08-31T10:00:00'));
assert.equal(cancelledEffective.meetings[0].next_date, '2026-09-07');
assert.equal(cancelledEffective.meetings[0].has_exception, false);

assert.ok(html.indexOf('js/pin-schedule.js') < html.indexOf('<script src="app.js'));
assert.match(html, /id="count-today-day"/);
assert.match(html, /id="count-today-evening"/);
assert.match(app, /PinSchedule\.withEffectiveOccurrence\(v\)/);
assert.match(app, /setInterval\(applyFilters, 60 \* 1000\)/);

console.log('pin schedule tests: ok');
