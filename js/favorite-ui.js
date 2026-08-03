// 断酒でGO お気に入り★ボタン UI ヘルパー（段階C・最小スタート）
// 純関数のみ。DOM 操作は app.js 側で行い、状態判定・ボタンHTMLはここで生成する。
(function exposeFavoriteUi(root) {
  'use strict';

  function isFavorite(favorites, meetingId) {
    if (!Array.isArray(favorites)) return false;
    const id = Number(meetingId);
    if (!id) return false;
    return favorites.some(f => Number(f && f.meeting_id) === id);
  }

  // お気に入り一覧を更新した新しい配列を返す（favorited=false なら除去）
  function toggleState(favorites, meetingId, favorited) {
    const id = Number(meetingId);
    const list = Array.isArray(favorites)
      ? favorites.filter(f => Number(f && f.meeting_id) !== id)
      : [];
    if (favorited && id) {
      list.push({ meeting_id: id });
    }
    return list;
  }

  function buttonHTML(meetingId, favorite) {
    const id = Number(meetingId);
    if (!id) return '';
    const fav = Boolean(favorite);
    const label = fav ? 'お気に入りから外す' : 'お気に入りに追加';
    return '<button type="button" class="fav-btn' + (fav ? ' is-fav' : '') +
      '" data-meeting-id="' + id + '" aria-pressed="' + fav +
      '" aria-label="' + label + '">' + (fav ? '★' : '☆') + '</button>';
  }

  const ui = {
    isFavorite,
    toggleState,
    buttonHTML
  };

  root.DanshuFavoriteUi = ui;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ui;
  }
})(typeof window !== 'undefined' ? window : globalThis);
