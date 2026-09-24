'use strict';

const assert = require('node:assert/strict');
const SpecialEvents = require('../js/special-events.js');

const atJst = value => new Date(`${value}+09:00`);
const fussa = {
  meeting_id: 497,
  name: '福生市民公開セミナー',
  meeting_type: 'セミナー',
  event_date: '2026-09-27'
};

assert.equal(SpecialEvents.getSpecialEvent(fussa, atJst('2026-08-13T00:00:00')).remaining_days, 45);
assert.equal(SpecialEvents.getSpecialEvent(fussa, atJst('2026-08-12T23:59:59')), null);
assert.equal(SpecialEvents.getSpecialEvent(fussa, atJst('2026-09-20T00:00:00')).is_soon, true);
assert.equal(SpecialEvents.getSpecialEvent(fussa, atJst('2026-09-28T00:00:00')), null);
assert.match(SpecialEvents.getSpecialEvent(fussa, atJst('2026-09-24T12:00:00')).asset.poster_url, /fussa-alcohol-seminar/);

assert.equal(SpecialEvents.classify({ name: '第58回 関東ブロック大会' }).kind, 'celebration');
assert.equal(SpecialEvents.classify({ name: '創立50周年記念例会' }).kind, 'celebration');
assert.equal(SpecialEvents.classify({ name: 'アルコール勉強会' }).kind, 'learning');

// 名前だけ残る未確定レコードは誤告知しない。
assert.equal(SpecialEvents.getSpecialEvent({
  name: '一日研修会', meeting_type: '通常', event_date: '', next_date: '2026-09-27'
}, atJst('2026-09-24T12:00:00')), null);

assert.equal(SpecialEvents.getSpecialEvent({
  ...fussa, end_time: '16:00'
}, atJst('2026-09-27T15:59:00')).date, '2026-09-27');
assert.equal(SpecialEvents.getSpecialEvent({
  ...fussa, end_time: '16:00'
}, atJst('2026-09-27T16:00:00')), null);

console.log('special event tests: ok');
