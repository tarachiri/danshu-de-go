// メニューから別ページへ移動した利用者を、元のマップ状態へ戻す。
// 検索結果などから直接開かれた場合は、通常の / へのリンクとして動作する。
(function setupReturnToMap(root) {
  'use strict';

  function shouldUseHistory() {
    const params = new URLSearchParams(root.location.search);
    if (params.get('from') === 'map' && root.history.length > 1) return true;
    if (!root.document.referrer) return false;
    try {
      const referrer = new URL(root.document.referrer);
      return referrer.origin === root.location.origin && referrer.pathname === '/';
    } catch (_) {
      return false;
    }
  }

  root.document.addEventListener('DOMContentLoaded', () => {
    root.document.querySelectorAll('[data-return-to-map]').forEach(link => {
      link.addEventListener('click', event => {
        if (!shouldUseHistory()) return;
        event.preventDefault();
        root.history.back();
      });
    });
  });
})(window);
