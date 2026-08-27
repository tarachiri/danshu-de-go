// tests/homepage-seo.test.js
// トップページのSEOメタ情報がhead書き換えで再び消えないための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SITE_URL = 'https://dansyu-go.nukadokonokai.com/';
const OGP_URL = `${SITE_URL}ogp.png`;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function metaContent(attribute, key) {
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${escapeRegex(key)}["']\\s+content=["']([^"']+)["']\\s*\\/?>`,
    'i'
  );
  const match = INDEX_HTML.match(pattern);
  assert.ok(match, `${attribute}="${key}" が見つかりません`);
  return match[1];
}

test('canonical・OGP・Twitter Cardが正規URLと共有画像を使う', () => {
  assert.match(
    INDEX_HTML,
    new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${escapeRegex(SITE_URL)}["']`)
  );
  assert.equal(metaContent('property', 'og:url'), SITE_URL);
  assert.equal(metaContent('property', 'og:type'), 'website');
  assert.equal(metaContent('property', 'og:locale'), 'ja_JP');
  assert.equal(metaContent('property', 'og:image'), OGP_URL);
  assert.equal(metaContent('property', 'og:image:width'), '1200');
  assert.equal(metaContent('property', 'og:image:height'), '630');
  assert.equal(metaContent('name', 'twitter:card'), 'summary_large_image');
  assert.equal(metaContent('name', 'twitter:image'), OGP_URL);
});

test('共有画像はリポジトリ内にあり1200x630のPNGである', () => {
  const image = fs.readFileSync(path.join(ROOT, 'ogp.png'));
  assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test('トップページのWebSite構造化データが表示内容と一致する', () => {
  const match = INDEX_HTML.match(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i
  );
  assert.ok(match, 'WebSite構造化データが見つかりません');
  const data = JSON.parse(match[1]);
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'WebSite');
  assert.equal(data.name, '断酒でGO!!');
  assert.equal(data.url, SITE_URL);
  assert.equal(data.inLanguage, 'ja-JP');
});

test('静的な地域検索入口を維持する', () => {
  assert.match(INDEX_HTML, /<h1[^>]*>全国の断酒会・例会を地域から探す<\/h1>/);
  for (const region of [
    'hokkaido', 'tohoku', 'kanto', 'hokuriku', 'chubu',
    'kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa'
  ]) {
    assert.match(INDEX_HTML, new RegExp(`href=["']/chiiki/${region}/["']`));
  }
});
