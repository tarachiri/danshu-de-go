'use strict';

const assert = require('node:assert/strict');
const identity = require('../js/browser-identity.js');

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function run() {
  const existing = makeStorage({ danshu_user_token: 'common-id' });
  assert.deepEqual(identity.initialize(existing, {}), {
    userToken: 'common-id',
    bulletinToken: 'common-id',
    migratedFromBulletin: false
  });

  const legacy = makeStorage({ bulletin_client_token: 'legacy-bulletin-id' });
  assert.deepEqual(identity.initialize(legacy, {}), {
    userToken: 'legacy-bulletin-id',
    bulletinToken: 'legacy-bulletin-id',
    migratedFromBulletin: true
  });

  const divergent = makeStorage({
    danshu_user_token: 'common-id',
    bulletin_client_token: 'ownership-id'
  });
  assert.deepEqual(identity.initialize(divergent, {}), {
    userToken: 'common-id',
    bulletinToken: 'ownership-id',
    migratedFromBulletin: false
  });

  const fresh = makeStorage();
  const cryptoProvider = { randomUUID: () => 'generated-secure-uuid' };
  assert.deepEqual(identity.initialize(fresh, cryptoProvider), {
    userToken: 'generated-secure-uuid',
    bulletinToken: 'generated-secure-uuid',
    migratedFromBulletin: false
  });

  assert.throws(
    () => identity.initialize(makeStorage(), {}),
    /Secure random number generation is not available/
  );

  console.log('browser identity tests: ok');
}

run();
