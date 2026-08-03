// 断酒でGO 共通ID解決API（段階B）
// PWA のブラウザIDを gen 公開プロキシ経由で tyo の利用者アカウントへ紐付ける。
// 応答は {"resolved": true, "created": bool} のみ。内部の user_account_id は返らない。
(function exposeIdentityApi(root) {
  'use strict';

  const RESOLVE_URL = 'https://chat.nukadokonokai.com/identity/resolve';
  const CACHE_KEY = 'danshu_identity_resolved';
  const REQUEST_TIMEOUT_MS = 8000;

  function getStorage() {
    try {
      return root.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function resolveIdentity(userToken) {
    const storage = getStorage();

    // 同一セッション内では1回の解決で十分（per-IPレート制限への配慮）。
    if (storage && storage.getItem(CACHE_KEY) === '1') {
      return Promise.resolve({ resolved: true, created: false, cached: true });
    }

    if (!userToken) {
      return Promise.resolve(null);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return root
      .fetch(RESOLVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browser_token: userToken }),
        signal: controller.signal
      })
      .then(response => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(data => {
        if (!data || data.resolved !== true) return null;
        if (storage) {
          try {
            storage.setItem(CACHE_KEY, '1');
          } catch (error) {
            // ストレージ容量・プライバシーモード等では保存を諦める
          }
        }
        return { resolved: true, created: Boolean(data.created), cached: false };
      })
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  const api = {
    resolve: resolveIdentity,
    RESOLVE_URL,
    CACHE_KEY,
    REQUEST_TIMEOUT_MS
  };

  root.DanshuIdentityApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
