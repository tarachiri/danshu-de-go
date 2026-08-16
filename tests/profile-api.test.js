'use strict';

const assert = require('node:assert/strict');
const api = require('../js/profile-api.js');

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

const TOKEN = 'token-1234567890123456';

async function run() {
  // 1. 取得: GET + X-Client-Token ヘッダー、プロフィールを返す
  {
    const payload = { display_name: 'たろう', prefecture: '埼玉県', city: 'さいたま市' };
    const fetchImpl = makeFetchImpl(() => jsonResponse(payload));
    globalThis.fetch = fetchImpl;

    const result = await api.get(TOKEN);
    assert.deepEqual(result, payload);
    assert.equal(fetchImpl.calls.length, 1);
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL);
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.headers['X-Client-Token'], TOKEN);
  }

  // 2. 取得: 404（未登録）は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ detail: 'not found' }, false, 404));
    const result = await api.get(TOKEN);
    assert.equal(result, null);
  }

  // 3. 取得: ネットワーク失敗は例外を投げず null
  {
    globalThis.fetch = makeFetchImpl(() => Promise.reject(new TypeError('network down')));
    const result = await api.get(TOKEN);
    assert.equal(result, null);
  }

  // 4. 取得: display_name が文字列でない応答は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ display_name: null }));
    const result = await api.get(TOKEN);
    assert.equal(result, null);
  }

  // 5. 取得: トークンなしは fetch せず null
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_name: 'x' }));
    globalThis.fetch = fetchImpl;
    const result = await api.get('');
    assert.equal(result, null);
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 6. 更新: PUT + JSON ボディ、保存結果を返す
  {
    const saved = { display_name: 'たろう', prefecture: '埼玉県', city: '' };
    const fetchImpl = makeFetchImpl(() => jsonResponse(saved));
    globalThis.fetch = fetchImpl;

    const result = await api.update(TOKEN, { display_name: 'たろう', prefecture: '埼玉県', city: '' });
    assert.deepEqual(result, saved);
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL);
    assert.equal(call.options.method, 'PUT');
    assert.deepEqual(JSON.parse(call.options.body), { display_name: 'たろう', prefecture: '埼玉県', city: '' });
  }

  // 7. 更新: display_name が空文字は fetch せず null
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({}));
    globalThis.fetch = fetchImpl;
    const result = await api.update(TOKEN, { display_name: '   ', prefecture: '埼玉県', city: '' });
    assert.equal(result, null);
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 8. 更新: display_name 前後の空白はトリムして送信
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_name: 'たろう', prefecture: '', city: '' }));
    globalThis.fetch = fetchImpl;
    await api.update(TOKEN, { display_name: '  たろう  ', prefecture: '', city: '' });
    const call = fetchImpl.calls[0];
    assert.equal(JSON.parse(call.options.body).display_name, 'たろう');
  }

  // 9. 更新: prefecture/city 省略時は空文字で送信
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_name: 'たろう', prefecture: '', city: '' }));
    globalThis.fetch = fetchImpl;
    await api.update(TOKEN, { display_name: 'たろう' });
    const call = fetchImpl.calls[0];
    assert.deepEqual(JSON.parse(call.options.body), { display_name: 'たろう', prefecture: '', city: '' });
  }

  // 10. 更新: 保存失敗（サーバーエラー）は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ detail: 'error' }, false, 500));
    const result = await api.update(TOKEN, { display_name: 'たろう' });
    assert.equal(result, null);
  }

  // 11. トークンはURLに載らない（ヘッダーのみ）
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_name: 'x', prefecture: '', city: '' }));
    globalThis.fetch = fetchImpl;
    await api.get('token-abc-1234567890');
    await api.update('token-abc-1234567890', { display_name: 'x' });
    for (const call of fetchImpl.calls) {
      assert.ok(!call.url.includes('token-abc'), 'token must not appear in URL');
      assert.ok(!call.url.includes('1234567890'), 'token must not appear in URL');
    }
  }

  console.log('profile api tests: ok');
}

run()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    globalThis.fetch = undefined;
  });
