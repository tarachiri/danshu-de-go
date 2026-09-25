'use strict';

const assert = require('node:assert/strict');

globalThis.PinSchedule = require('../js/pin-schedule.js');
require('../js/uranai.js');

const Uranai = globalThis.DanshuUranai;
const now = new Date('2026-09-25T14:00:00+09:00');
const venues = [
  {
    id: 1, lat: 35.7, lng: 139.7, prefecture: '東京都', facility_name: '第一会館',
    meetings: [
      {
        meeting_id: 11, name: '終了済み例会', next_date: '2026-09-25', next_date_2: '2026-09-26',
        start_time: '10:00', end_time: '12:00'
      },
      {
        meeting_id: 12, name: '開催中例会', next_date: '2026-09-25',
        start_time: '13:00', end_time: '15:00'
      },
      {
        meeting_id: 13, name: '中止例会', next_date: '2026-09-25', next_date_2: '2026-09-27',
        start_time: '18:00', end_time: '20:00', has_exception: true, exc_type: 'cancel'
      }
    ]
  }
];

const candidates = Uranai.collectCandidates(venues, now);
assert.deepEqual(
  candidates
    .map(candidate => [candidate.name, candidate.next_date])
    .sort((a, b) => a[1].localeCompare(b[1])),
  [
    ['開催中例会', '2026-09-25'],
    ['終了済み例会', '2026-09-26'],
    ['中止例会', '2026-09-27']
  ]
);

const nearby = Uranai.pickNearby([
  { name: '近い', lat: 35.7, lng: 139.7, start_time: '10:00' },
  { name: '遠い', lat: 36.0, lng: 139.7, start_time: '10:00' }
], 35.7, 139.7);
assert.deepEqual(nearby.map(candidate => candidate.name), ['近い']);
assert.equal(Uranai.MAX_DISTANCE_KM, 20);

console.log('uranai tests: ok');
