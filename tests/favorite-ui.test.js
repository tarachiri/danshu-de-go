'use strict';

const assert = require('node:assert/strict');
const ui = require('../js/favorite-ui.js');

function run() {
  // 1. isFavorite: 一致するmeeting_idがあれば true
  {
    const favorites = [{ meeting_id: 1 }, { meeting_id: 42 }];
    assert.equal(ui.isFavorite(favorites, 1), true);
    assert.equal(ui.isFavorite(favorites, '42'), true); // 文字列IDも許容
    assert.equal(ui.isFavorite(favorites, 2), false);
  }

  // 2. isFavorite: 空・null・不正値は false（例外を投げない）
  {
    assert.equal(ui.isFavorite(null, 1), false);
    assert.equal(ui.isFavorite([], 1), false);
    assert.equal(ui.isFavorite([{ meeting_id: 1 }], null), false);
    assert.equal(ui.isFavorite([{ meeting_id: 1 }], 0), false);
  }

  // 3. toggleState: 登録で追加・重複は置換
  {
    const favorites = [{ meeting_id: 1 }, { meeting_id: 2 }];
    const added = ui.toggleState(favorites, 3, true);
    assert.deepEqual(added, [{ meeting_id: 1 }, { meeting_id: 2 }, { meeting_id: 3 }]);
    const dup = ui.toggleState(favorites, 2, true);
    assert.deepEqual(dup, [{ meeting_id: 1 }, { meeting_id: 2 }]); // 重複なし
  }

  // 4. toggleState: 解除で除去・null 入力でも安全
  {
    const favorites = [{ meeting_id: 1 }, { meeting_id: 2 }];
    const removed = ui.toggleState(favorites, 1, false);
    assert.deepEqual(removed, [{ meeting_id: 2 }]);
    assert.deepEqual(ui.toggleState(null, 1, true), [{ meeting_id: 1 }]);
    assert.deepEqual(ui.toggleState(null, 1, false), []);
  }

  // 5. buttonHTML: 通常状態は ☆・data属性・aria属性付き
  {
    const html = ui.buttonHTML(5, false);
    assert.ok(html.includes('class="fav-btn"'));
    assert.ok(html.includes('data-meeting-id="5"'));
    assert.ok(html.includes('aria-pressed="false"'));
    assert.ok(html.includes('>☆<'));
    assert.ok(html.includes('aria-label="お気に入りに追加"'));
  }

  // 6. buttonHTML: 登録済みは ★・is-fav・aria-pressed=true
  {
    const html = ui.buttonHTML(5, true);
    assert.ok(html.includes('class="fav-btn is-fav"'));
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('>★<'));
    assert.ok(html.includes('aria-label="お気に入りから外す"'));
  }

  // 7. buttonHTML: 不正なmeeting_idは空文字
  {
    assert.equal(ui.buttonHTML(0, false), '');
    assert.equal(ui.buttonHTML(null, false), '');
  }

  console.log('favorite ui tests: ok');
}

run();
