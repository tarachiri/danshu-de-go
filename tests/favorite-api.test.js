'use strict';

const assert = require('node:assert/strict');
const api = require('../js/favorite-api.js');

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
  // 1. 一覧: POST /favorites + X-Client-Token ヘッダー、配列を返す
  {
    const payload = { favorites: [{ meeting_id: 1, name: '水曜例会', group_name: '葛飾断酒会' }] };
    const fetchImpl = makeFetchImpl(() => jsonResponse(payload));
    globalThis.fetch = fetchImpl;

    const result = await api.list(TOKEN);
    assert.deepEqual(result, payload.favorites);
    assert.equal(fetchImpl.calls.length, 1);
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers['X-Client-Token'], TOKEN);
  }

  // 2. 一覧: エラー応答は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ detail: 'error' }, false, 500));
    const result = await api.list(TOKEN);
    assert.equal(result, null);
  }

  // 3. 一覧: ネットワーク失敗は例外を投げず null
  {
    globalThis.fetch = makeFetchImpl(() => Promise.reject(new TypeError('network down')));
    const result = await api.list(TOKEN);
    assert.equal(result, null);
  }

  // 4. 一覧: favorites が配列でない応答は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ favorites: 'bogus' }));
    const result = await api.list(TOKEN);
    assert.equal(result, null);
  }

  // 5. トークンなしは fetch せず null
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ favorites: [] }));
    globalThis.fetch = fetchImpl;
    const result = await api.list('');
    assert.equal(result, null);
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 6. 登録: PUT /favorites/{id} で favorited:true を返す
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ meeting_id: 5, favorited: true }));
    globalThis.fetch = fetchImpl;
    const result = await api.add(TOKEN, 5);
    assert.deepEqual(result, { meeting_id: 5, favorited: true });
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL + '/5');
    assert.equal(call.options.method, 'PUT');
  }

  // 7. 登録: favorited が true でない応答は null
  {
    globalThis.fetch = makeFetchImpl(() => jsonResponse({ meeting_id: 5, favorited: false }));
    const result = await api.add(TOKEN, 5);
    assert.equal(result, null);
  }

  // 8. 削除: DELETE /favorites/{id} で favorited:false を返す
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ meeting_id: 5, favorited: false }));
    globalThis.fetch = fetchImpl;
    const result = await api.remove(TOKEN, 5);
    assert.deepEqual(result, { meeting_id: 5, favorited: false });
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL + '/5');
    assert.equal(call.options.method, 'DELETE');
  }

  // 9. 設定取得: GET /favorites/calendar-settings
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_mode: 'name_and_time', font_size: 'large' }));
    globalThis.fetch = fetchImpl;
    const result = await api.getCalendarSettings(TOKEN);
    assert.deepEqual(result, { display_mode: 'name_and_time', font_size: 'large' });
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL + '/calendar-settings');
    assert.equal(call.options.method, 'GET');
  }

  // 10. 設定更新: PUT + JSON ボディ、保存結果を返す
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ display_mode: 'name_only', font_size: 'normal' }));
    globalThis.fetch = fetchImpl;
    const result = await api.updateCalendarSettings(TOKEN, { display_mode: 'name_only', font_size: 'normal' });
    assert.deepEqual(result, { display_mode: 'name_only', font_size: 'normal' });
    const call = fetchImpl.calls[0];
    assert.equal(call.url, api.BASE_URL + '/calendar-settings');
    assert.equal(call.options.method, 'PUT');
    assert.deepEqual(JSON.parse(call.options.body), { display_mode: 'name_only', font_size: 'normal' });
  }

  // 11. 設定更新: 不正な引数は fetch せず null
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({}));
    globalThis.fetch = fetchImpl;
    const result = await api.updateCalendarSettings(TOKEN, { display_mode: 'bogus' });
    assert.equal(result, null);
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 12. トークンはURLに載らない（ヘッダーのみ）
  {
    const fetchImpl = makeFetchImpl(() => jsonResponse({ favorites: [] }));
    globalThis.fetch = fetchImpl;
    await api.list('token-abc-1234567890');
    await api.add('token-abc-1234567890', 7);
    await api.remove('token-abc-1234567890', 7);
    await api.getCalendarSettings('token-abc-1234567890');
    await api.updateCalendarSettings('token-abc-1234567890', { display_mode: 'name_only', font_size: 'normal' });
    for (const call of fetchImpl.calls) {
      assert.ok(!call.url.includes('token-abc'), 'token must not appear in URL');
      assert.ok(!call.url.includes('1234567890'), 'token must not appear in URL');
    }
  }

  console.log('favorite api tests: ok');
}

run()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    globalThis.fetch = undefined;
  });
