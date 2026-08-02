// 断酒でGO共通ブラウザID（段階A）
// 旧掲示板IDを共通IDへ引き継ぎつつ、掲示板は旧IDを保持して所有権を守る。
(function exposeBrowserIdentity(root) {
  'use strict';

  const USER_TOKEN_KEY = 'danshu_user_token';
  const BULLETIN_TOKEN_KEY = 'bulletin_client_token';

  function generateToken(cryptoProvider) {
    if (cryptoProvider && typeof cryptoProvider.randomUUID === 'function') {
      return cryptoProvider.randomUUID();
    }

    if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
      throw new Error('Secure random number generation is not available');
    }

    const bytes = new Uint8Array(16);
    cryptoProvider.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-');
  }

  function initialize(storage, cryptoProvider) {
    let userToken = storage.getItem(USER_TOKEN_KEY);
    let bulletinToken = storage.getItem(BULLETIN_TOKEN_KEY);
    const migratedFromBulletin = !userToken && Boolean(bulletinToken);

    if (!userToken) {
      userToken = bulletinToken || generateToken(cryptoProvider);
      storage.setItem(USER_TOKEN_KEY, userToken);
    }

    // 新規利用者は共通IDと掲示板IDを同じ値にする。旧掲示板IDが別に存在する
    // 場合は、投稿・返信の所有権を失わないよう掲示板側の値を上書きしない。
    if (!bulletinToken) {
      bulletinToken = userToken;
      storage.setItem(BULLETIN_TOKEN_KEY, bulletinToken);
    }

    return { userToken, bulletinToken, migratedFromBulletin };
  }

  const api = {
    initialize,
    generateToken,
    USER_TOKEN_KEY,
    BULLETIN_TOKEN_KEY
  };

  root.DanshuBrowserIdentity = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
