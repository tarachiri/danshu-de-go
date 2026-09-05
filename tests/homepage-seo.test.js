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

test('検索目的がtitle・description・唯一のh1で明確になっている', () => {
  const title = '全国の断酒会・例会場を地図で検索｜断酒でGO!!';
  const description = metaContent('name', 'description');
  assert.match(
    INDEX_HTML,
    /<title>全国の断酒会・例会場を地図で検索｜断酒でGO!!<\/title>/
  );
  assert.match(
    description,
    /全国の断酒会例会場と開催日程を地図で検索/
  );
  assert.equal(metaContent('property', 'og:title'), title);
  assert.equal(metaContent('name', 'twitter:title'), title);
  assert.equal(metaContent('property', 'og:description'), description);
  assert.equal(metaContent('name', 'twitter:description'), description);
  assert.equal((INDEX_HTML.match(/<h1\b/gi) || []).length, 1);
  assert.match(
    INDEX_HTML,
    /<main id="main-content">[\s\S]*?<h1 class="sp-title">[\s\S]*?断酒でGO[\s\S]*?全国の断酒会・例会場を探す[\s\S]*?<\/h1>/
  );
});

test('静的な主要導線と地域検索入口を維持する', () => {
  assert.match(INDEX_HTML, /<main id="main-content">/);
  assert.match(INDEX_HTML, /<header id="header">/);
  assert.match(INDEX_HTML, /<nav class="seo-primary-links" aria-label="例会の探し方">/);
  for (const path of ['/calendar.html', '/chiiki/', '/about.html']) {
    assert.match(INDEX_HTML, new RegExp(`href=["']${escapeRegex(path)}["']`));
  }
  for (const region of [
    'hokkaido', 'tohoku', 'kanto', 'hokuriku', 'chubu',
    'kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa'
  ]) {
    assert.match(INDEX_HTML, new RegExp(`href=["']/chiiki/${region}/["']`));
  }
});

test('掲載範囲・最新情報の確認・修正連絡の説明を表示する', () => {
  assert.match(INDEX_HTML, /<section class="seo-trust"/);
  assert.match(INDEX_HTML, /AA（アルコホーリクス・アノニマス）は別団体/);
  assert.match(INDEX_HTML, /参加前に主催団体の最新情報もご確認ください/);
  assert.match(INDEX_HTML, /href="\/gogo-submit\.html"/);
});
