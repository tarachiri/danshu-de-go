'use strict';

const assert = require('node:assert/strict');
const api = require('../js/identity-api.js');

function makeSessionStorage(initial = {}) {
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

function makeFetchImpl(handler) {
  const calls = [];
  const impl = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(handler(url, options));
  };
  impl.calls = calls;
  return impl;
}

function jsonResponse(payload, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: () => Promise.resolve(payload) };
}

async function run() {
  // 1. 正常系: 正しいURL・POSTボディで解決し、resolved/created を返す
  {
    const session = makeSessionStorage();
    globalThis.sessionStorage = session;
    const fetchImpl = makeFetchImpl(() => jsonResponse({ resolved: true, created: false }));
    globalThis.fetch = fetchImpl;

    const result = await api.resolve('token-1234567890123456');
    assert.deepEqual(result, { resolved: true, created: false, cached: false });
    assert.equal(fetchImpl.calls.length, 1);
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.RESOLVE_URL);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(call.options.body), { browser_token: 'token-1234567890123456' });
    assert.equal(session.getItem(api.CACHE_KEY), '1');
  }

  // 2. created:true をそのまま返す
  {
    globalThis.sessionStorage = makeSessionStorage();
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ resolved: true, created: true }));
    const result = await api.resolve('new-token-1234567890');
    assert.deepEqual(result, { resolved: true, created: true, cached: false });
  }

  // 3. 同一セッション2回目はfetchせずキャッシュを返す
  {
    const session = makeSessionStorage({ [api.CACHE_KEY]: '1' });
    globalThis.sessionStorage = session;
    const fetchImpl = makeFetchImpl(() => jsonResponse({ resolved: true, created: true }));
    globalThis.fetch = fetchImpl;
    const result = await api.resolve('token-1234567890123456');
    assert.deepEqual(result, { resolved: true, created: false, cached: true });
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 4. エラー応答（500）は null を返し、キャッシュしない
  {
    const session = makeSessionStorage();
    globalThis.sessionStorage = session;
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ detail: 'error' }, false, 500));
    const result = await api.resolve('token-1234567890123456');
    assert.equal(result, null);
    assert.equal(session.getItem(api.CACHE_KEY), null);
  }

  // 5. ネットワーク失敗は例外を投げず null を返す
  {
    const session = makeSessionStorage();
    globalThis.sessionStorage = session;
    globalThis.fetch = makeFetchImpl(() => Promise.reject(new TypeError('network down')));
    const result = await api.resolve('token-1234567890123456');
    assert.equal(result, null);
    assert.equal(session.getItem(api.CACHE_KEY), null);
  }

  // 6. トークンなしはfetchせず null
  {
    globalThis.sessionStorage = makeSessionStorage();
    const fetchImpl = makeFetchImpl(() => jsonResponse({ resolved: true }));
    globalThis.fetch = fetchImpl;
    const result = await api.resolve('');
    assert.equal(result, null);
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 7. resolved が true でない応答は null
  {
    globalThis.sessionStorage = makeSessionStorage();
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ resolved: false }));
    const result = await api.resolve('token-1234567890123456');
    assert.equal(result, null);
  }

  // 8. トークンはURLに載らずボディのみ（2重チェック）
  {
    globalThis.sessionStorage = makeSessionStorage();
    const fetchImpl = makeFetchImpl(() => jsonResponse({ resolved: true, created: false }));
    globalThis.fetch = fetchImpl;
    await api.resolve('token-abc-1234567890');
    const call = fetchImpl.calls[0];
    assert.ok(!call.url.includes('token-abc'), 'token must not appear in URL');
    assert.ok(!call.url.includes('1234567890'), 'token must not appear in URL');
  }

  console.log('identity api tests: ok');
}

run()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    globalThis.fetch = undefined;
    globalThis.sessionStorage = undefined;
  });
