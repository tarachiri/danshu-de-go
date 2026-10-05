// 情報源一覧が公開済みデータだけから安全に生成されるための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'sources', 'index.html'), 'utf8');
const VENUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'venues.json'), 'utf8'));
const { normalizePublicUrl } = require('../scripts/generate_sources_page');

test('47都道府県を情報源の有無にかかわらず表示する', () => {
  const sections = HTML.match(/<section class="prefecture" id="[^"]+">/g) || [];
  assert.equal(sections.length, 47);
  assert.match(HTML, /公開できる情報源URLは現在整理中です/);
});

test('絶対HTTP URLだけを掲載し、同じ都道府県内では重複しない', () => {
  const sections = [...HTML.matchAll(/<section class="prefecture"[^>]*>([\s\S]*?)<\/section>/g)];
  for (const [, section] of sections) {
    const links = [...section.matchAll(/<a href="(https?:\/\/[^"#]+)" target="_blank"/g)]
      .map(match => match[1].replaceAll('&amp;', '&'));
    assert.equal(new Set(links).size, links.length);
    for (const url of links) assert.equal(normalizePublicUrl(url), url);
  }
});

test('公開ページに電話番号や内部確認項目を出力しない', () => {
  for (const venue of VENUES) {
    if (venue.contact_phone) assert.doesNotMatch(HTML, new RegExp(venue.contact_phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(HTML, /needs_verification|geo_failed|imported_at/);
});

test('canonicalと主要内部リンクを備える', () => {
  assert.match(HTML, /<link rel="canonical" href="https:\/\/dansyu-go\.nukadokonokai\.com\/sources\/">/);
  for (const route of ['/about.html', '/gogo-submit.html']) {
    assert.match(HTML, new RegExp(`href="${route.replaceAll('/', '\\/')}"`));
  }
});
