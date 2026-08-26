// 断酒でGO 探索記録API
// ブラウザIDで本人の訪問・会場閲覧を記録する。内部利用者IDは扱わない。
(function exposeActivityApi(root) {
  'use strict';

  const BASE_URL = 'https://chat.nukadokonokai.com/identity/activity';
  const REQUEST_TIMEOUT_MS = 8000;
  const VISIT_CACHE_PREFIX = 'danshu_activity_visit_';
  const venueDebounce = new Map();

  function todayJst() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function request(method, path, userToken) {
    const headers = {};
    if (userToken) headers['X-Client-Token'] = userToken;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    return root.fetch(BASE_URL + path, { method, headers, signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  function recordVisit(userToken) {
    if (!userToken) return Promise.resolve(null);
    const cacheKey = VISIT_CACHE_PREFIX + todayJst();
    try {
      if (root.localStorage && root.localStorage.getItem(cacheKey) === '1') {
        return Promise.resolve({ recorded: false, cached: true });
      }
    } catch (error) {
      // 保存できなくてもサーバー側の日別一意制約で重複日は増えない。
    }
    return request('POST', '/visit', userToken).then(result => {
      if (result) {
        try { if (root.localStorage) root.localStorage.setItem(cacheKey, '1'); } catch (error) {}
      }
      return result;
    });
  }

  function recordVenueView(userToken, venueId) {
    const id = Number(venueId);
    if (!userToken || !Number.isInteger(id) || id < 1) return Promise.resolve(null);
    const now = Date.now();
    if (now - (venueDebounce.get(id) || 0) < 5000) {
      return Promise.resolve({ recorded: false, debounced: true });
    }
    venueDebounce.set(id, now);
    return request('POST', `/venues/${id}/view`, userToken).then(result => {
      if (!result) venueDebounce.delete(id);
      return result;
    });
  }

  const api = {
    recordVisit,
    recordVenueView,
    getProfile(userToken) { return userToken ? request('GET', '/profile', userToken) : Promise.resolve(null); },
    getSummary(venueId) {
      const suffix = venueId == null ? '/summary' : `/summary?venue_id=${encodeURIComponent(venueId)}`;
      return request('GET', suffix, null);
    },
    BASE_URL,
    REQUEST_TIMEOUT_MS,
    _resetDebounce() { venueDebounce.clear(); }
  };

  root.DanshuActivityApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
