// 断酒でGO 会員プロフィールAPI（簡易版会員登録）
// ブラウザID（X-Client-Token ヘッダー）で gen 公開プロキシ経由で tyo の
// 表示名・都道府県・市区町村を読み書きする。
// 内部の user_account_id はどの応答にも含まれない。失敗時（404含む）は
// null を返し例外を投げない（既存機能に影響させないサイレント設計）。
// 404（未登録）と通信エラーはどちらも null になるが、呼び出し側にとっては
// どちらも「新規登録フォームを表示する」という同じ扱いになるため区別不要。
(function exposeProfileApi(root) {
  'use strict';

  const BASE_URL = 'https://chat.nukadokonokai.com/identity/profile';
  const REQUEST_TIMEOUT_MS = 8000;

  function tokenHeaders(userToken) {
    if (!userToken) return null;
    return { 'X-Client-Token': userToken };
  }

  function request(method, userToken, body) {
    const headers = tokenHeaders(userToken);
    if (!headers) return Promise.resolve(null);
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return root
      .fetch(BASE_URL, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      .then(response => {
        if (!response.ok) return null;
        return response.json();
      })
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  function isValidProfile(data) {
    return Boolean(data) && typeof data.display_name === 'string';
  }

  const api = {
    // 応答: {display_name, prefecture, city} または null（未登録・エラー共通）
    get(userToken) {
      return request('GET', userToken).then(data => (isValidProfile(data) ? data : null));
    },
    // display_name は必須（空文字・非文字列は送信せず null を返す）
    update(userToken, profile) {
      if (!profile || typeof profile.display_name !== 'string' || !profile.display_name.trim()) {
        return Promise.resolve(null);
      }
      const body = {
        display_name: profile.display_name.trim(),
        prefecture: typeof profile.prefecture === 'string' ? profile.prefecture : '',
        city: typeof profile.city === 'string' ? profile.city : ''
      };
      return request('PUT', userToken, body).then(data => (isValidProfile(data) ? data : null));
    },
    BASE_URL,
    REQUEST_TIMEOUT_MS
  };

  root.DanshuProfileApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
