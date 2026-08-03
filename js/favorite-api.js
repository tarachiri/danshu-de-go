// 断酒でGO お気に入り・MyカレンダーAPI（段階B）
// ブラウザID（X-Client-Token ヘッダー）で gen 公開プロキシ経由で tyo の
// お気に入り例会・カレンダー設定を読み書きする。
// 内部の user_account_id はどの応答にも含まれない。失敗時は null を返し
// 例外を投げない（既存機能に影響させないサイレント設計）。
(function exposeFavoriteApi(root) {
  'use strict';

  const BASE_URL = 'https://chat.nukadokonokai.com/favorites';
  const REQUEST_TIMEOUT_MS = 8000;

  function tokenHeaders(userToken) {
    if (!userToken) return null;
    return { 'X-Client-Token': userToken };
  }

  function request(method, path, userToken, body) {
    const headers = tokenHeaders(userToken);
    if (!headers) return Promise.resolve(null);
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return root
      .fetch(BASE_URL + path, {
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

  const api = {
    // お気に入り一覧: [{ meeting_id, name, group_name, day_of_week, start_time }]
    list(userToken) {
      return request('POST', '', userToken).then(data => {
        if (!data || !Array.isArray(data.favorites)) return null;
        return data.favorites;
      });
    },
    add(userToken, meetingId) {
      return request('PUT', '/' + meetingId, userToken).then(data => {
        if (!data || data.favorited !== true) return null;
        return data;
      });
    },
    remove(userToken, meetingId) {
      return request('DELETE', '/' + meetingId, userToken).then(data => {
        if (!data || data.favorited !== false) return null;
        return data;
      });
    },
    getCalendarSettings(userToken) {
      return request('GET', '/calendar-settings', userToken).then(data => {
        if (!data || typeof data.display_mode !== 'string') return null;
        return data;
      });
    },
    updateCalendarSettings(userToken, settings) {
      if (!settings || typeof settings.display_mode !== 'string' || typeof settings.font_size !== 'string') {
        return Promise.resolve(null);
      }
      return request('PUT', '/calendar-settings', userToken, {
        display_mode: settings.display_mode,
        font_size: settings.font_size
      }).then(data => {
        if (!data || typeof data.display_mode !== 'string') return null;
        return data;
      });
    },
    BASE_URL,
    REQUEST_TIMEOUT_MS
  };

  root.DanshuFavoriteApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
