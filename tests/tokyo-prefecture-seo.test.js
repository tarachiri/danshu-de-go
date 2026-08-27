// 東京都ページの表示件数と機械可読な団体一覧がずれないための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const TOKYO_HTML = fs.readFileSync(
  path.join(ROOT, 'chiiki', 'kanto', 'tokyo', 'index.html'),
  'utf8'
);

test('東京都ページは25断酒会・2連合会の内訳を明示する', () => {
  assert.match(
    TOKYO_HTML,
    /全日本断酒連盟加盟の25断酒会・2連合会（計27団体ページ）の一覧です。/
  );
  assert.match(
    TOKYO_HTML,
    /<strong>25断酒会・2連合会<\/strong>（計27団体ページ）/
  );
});

test('ItemListは画面上の27団体リンクと一致する', () => {
  const scripts = [...TOKYO_HTML.matchAll(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
  )].map((match) => JSON.parse(match[1]));
  const itemList = scripts.find((data) => data['@type'] === 'ItemList');
  assert.ok(itemList, 'ItemList構造化データが見つかりません');
  assert.equal(itemList.numberOfItems, 27);
  assert.equal(itemList.itemListElement.length, 27);
  assert.deepEqual(
    itemList.itemListElement.map((item) => item.position),
    Array.from({ length: 27 }, (_, index) => index + 1)
  );

  const pageLinks = [...TOKYO_HTML.matchAll(/href="\.\/(org-\d+)\/"/g)]
    .map((match) => match[1]);
  const structuredLinks = itemList.itemListElement
    .map((item) => item.url.match(/\/(org-\d+)\/$/)[1]);
  assert.deepEqual(structuredLinks, pageLinks);
});
