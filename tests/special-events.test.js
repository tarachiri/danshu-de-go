'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SpecialEvents = require('../js/special-events.js');

const atJst = value => new Date(`${value}+09:00`);
const event = (overrides = {}) => ({
  event_id: 1,
  occurrence_id: 11,
  title: '福生市民公開セミナー・アルコール勉強会',
  description: '説明',
  category: 'learning',
  event_type: 'セミナー・勉強会',
  starts_at: '2026-09-27T13:30:00+09:00',
  ends_at: '2026-09-27T16:00:00+09:00',
  venue: { id: 1955, name: '福生市社会福祉協議会', address: '東京都福生市', prefecture: '東京都', lat: 35.7, lng: 139.3 },
  promotion: {
    map_from: '2026-08-13T00:00:00+09:00',
    map_until: '2026-09-27T16:00:00+09:00',
    feature_from: '2026-09-20T00:00:00+09:00',
    feature_until: '2026-09-27T16:00:00+09:00',
    priority: 100
  },
  poster: { kind: 'poster_image', url: 'assets/fussa.jpg', alt: '福生ポスター' },
  ...overrides
});

const tama = event({
  event_id: 2,
  occurrence_id: 22,
  title: '空と森とボクのココロ in 多摩平の森 2026',
  category: 'outreach',
  starts_at: '2026-10-25T10:00:00+09:00',
  ends_at: '2026-10-25T17:00:00+09:00',
  venue: { id: 2000, name: 'イオンモール多摩平の森', address: '東京都日野市', prefecture: '東京都', lat: 35.66, lng: 139.38 },
  promotion: {
    map_from: '2026-09-10T00:00:00+09:00',
    map_until: '2026-10-25T17:00:00+09:00',
    feature_from: '2026-09-27T16:00:00+09:00',
    feature_until: '2026-10-25T17:00:00+09:00',
    priority: 90
  },
  poster: { kind: 'poster_image', url: 'assets/tama.jpg', alt: '多摩ポスター' }
});

const venues = [{
  id: 1955, facility_name: '福生市社会福祉協議会', address: '東京都福生市',
  prefecture: '東京都', lat: 35.7, lng: 139.3, meetings: []
}];
SpecialEvents.mergeIntoVenues(venues, { schema_version: 1, events: [event(), tama] });

assert.equal(venues.length, 2, 'イベント専用会場も地図会場へ安全に補完する');
assert.equal(SpecialEvents.findForVenue(venues[0], atJst('2026-08-13T00:00:00')).remaining_days, 45);
assert.equal(SpecialEvents.findForVenue(venues[0], atJst('2026-08-12T23:59:59')), null);
assert.match(SpecialEvents.findForVenue(venues[0], atJst('2026-09-24T12:00:00')).asset.poster_url, /fussa/);
assert.equal(SpecialEvents.findAllForVenue(venues[1], atJst('2026-09-24T12:00:00'))[0].kind, 'outreach');

const beforeSwap = SpecialEvents.findFeaturedForVenues(venues, atJst('2026-09-27T15:59:00'));
assert.equal(beforeSwap[0].event.event_id, 1);
const afterSwap = SpecialEvents.findFeaturedForVenues(venues, atJst('2026-09-27T16:00:00'));
assert.equal(afterSwap.length, 1);
assert.equal(afterSwap[0].event.event_id, 2);
assert.equal(SpecialEvents.findForVenue(venues[0], atJst('2026-09-27T16:00:00')), null);
assert.equal(SpecialEvents.findFeaturedForVenues(venues, atJst('2026-10-25T17:00:00')).length, 0);

assert.equal(SpecialEvents.classify({ title: '第58回 関東ブロック大会' }).kind, 'celebration');
assert.equal(SpecialEvents.classify({ title: '創立50周年記念例会' }).kind, 'celebration');
assert.equal(SpecialEvents.classify({ title: 'アルコール勉強会' }).kind, 'learning');

// 移行中の旧データはピンだけ維持し、ポスターをコードへ再び直書きしない。
const legacy = SpecialEvents.getSpecialEvent({
  meeting_id: 497, name: '福生市民公開セミナー', meeting_type: 'セミナー',
  event_date: '2026-09-27', end_time: '16:00'
}, atJst('2026-09-24T12:00:00'));
assert.equal(legacy.asset, null);
assert.equal(SpecialEvents.getSpecialEvent(legacy.meeting, atJst('2026-09-27T15:59:00')).date, '2026-09-27');
assert.equal(SpecialEvents.getSpecialEvent(legacy.meeting, atJst('2026-09-27T16:00:00')), null);

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.match(app, /fetch\('special_events\.json', \{ cache: 'no-cache' \}\)/);
assert.match(app, /SpecialEvents\.mergeIntoVenues/);
assert.match(app, /data-poster-url=/);
assert.doesNotMatch(app, /onclick="openEventPoster\(decodeURIComponent/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/special-events.js'), 'utf8'), /2026-09-27-fussa-alcohol-seminar/);

console.log('special event tests: ok');
