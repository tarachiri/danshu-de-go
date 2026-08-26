'use strict';

const assert = require('node:assert/strict');
const api = require('../js/activity-api.js');

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function fetchRecorder(payload) {
  const calls = [];
  const fn = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  };
  fn.calls = calls;
  return fn;
}

async function run() {
  const token = 'token-1234567890123456';

  globalThis.localStorage = storage();
  globalThis.fetch = fetchRecorder({ recorded: true, visit_days: 1 });
  const visit = await api.recordVisit(token);
  assert.equal(visit.visit_days, 1);
  assert.equal(globalThis.fetch.calls[0].options.headers['X-Client-Token'], token);
  assert.ok(globalThis.fetch.calls[0].url.endsWith('/visit'));
  await api.recordVisit(token);
  assert.equal(globalThis.fetch.calls.length, 1, 'same JST day must use local cache');

  api._resetDebounce();
  globalThis.fetch = fetchRecorder({ recorded: true, global_count: 100 });
  const viewed = await api.recordVenueView(token, 10);
  assert.equal(viewed.global_count, 100);
  assert.ok(globalThis.fetch.calls[0].url.endsWith('/venues/10/view'));
  await api.recordVenueView(token, 10);
  assert.equal(globalThis.fetch.calls.length, 1, 'rapid duplicate venue opens must be debounced');

  globalThis.fetch = fetchRecorder({ periods: { total: { pin_taps: 100 } } });
  await api.getProfile(token);
  await api.getSummary();
  await api.getSummary(10);
  assert.ok(globalThis.fetch.calls[0].url.endsWith('/profile'));
  assert.ok(globalThis.fetch.calls[1].url.endsWith('/summary'));
  assert.ok(globalThis.fetch.calls[2].url.endsWith('/summary?venue_id=10'));
  assert.equal(globalThis.fetch.calls[1].options.headers['X-Client-Token'], undefined);

  const before = globalThis.fetch.calls.length;
  assert.equal(await api.recordVenueView(token, 0), null);
  assert.equal(await api.getProfile(''), null);
  assert.equal(globalThis.fetch.calls.length, before);

  console.log('activity api tests: ok');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  globalThis.fetch = undefined;
  globalThis.localStorage = undefined;
});
