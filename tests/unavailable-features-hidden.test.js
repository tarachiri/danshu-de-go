const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('停止中のチャットとPDFカレンダーへの公開導線を表示しない', () => {
  const index = read('index.html');
  const menu = read('js/menu.js');
  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');

  assert.doesNotMatch(index, /href=["']\/?calendar\.html["']/);
  assert.doesNotMatch(menu, /window\.open\(["']chat\.html["']/);
  assert.doesNotMatch(sitemap, /\/(?:chat|calendar)\.html/);
  assert.doesNotMatch(llms, /\/(?:chat|calendar)\.html/);
});

test('正常稼働中の例会検索と投稿導線は残す', () => {
  const index = read('index.html');
  const menu = read('js/menu.js');

  assert.match(index, /href=["']\/meetings\/["']/);
  assert.match(index, /href=["']\/chiiki\/["']/);
  assert.match(menu, /gogo-submit\.html/);
});
