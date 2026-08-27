// tests/about-page.test.js
// aboutページが準備中へ戻らず、運営・情報源・注意事項を維持するための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const ABOUT = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
const SITEMAP = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const ABOUT_URL = 'https://dansyu-go.nukadokonokai.com/about.html';

test('aboutページは準備中ではなく目的・情報源・注意事項を説明する', () => {
  assert.doesNotMatch(ABOUT, /準備中/);
  for (const heading of [
    'このサービスでできること',
    '掲載対象と情報源',
    '情報の更新について',
    'ご利用上の注意',
    '運営について',
    '例会情報の追加・修正'
  ]) {
    assert.match(ABOUT, new RegExp(`<h2>${heading}</h2>`));
  }
  assert.match(ABOUT, /運営・開発：ぬか床の会/);
  assert.match(ABOUT, /公式サイトではありません/);
  assert.match(ABOUT, /医療機関ではなく、診断・治療・緊急対応を行うものではありません/);
});

test('aboutページのcanonicalと構造化データが一致する', () => {
  assert.match(
    ABOUT,
    new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${ABOUT_URL.replaceAll('.', '\\.')}["']`)
  );
  const match = ABOUT.match(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i
  );
  assert.ok(match, 'AboutPage構造化データが見つかりません');
  const data = JSON.parse(match[1]);
  assert.equal(data['@type'], 'AboutPage');
  assert.equal(data.url, ABOUT_URL);
  assert.equal(data.inLanguage, 'ja-JP');
  assert.equal(data.isPartOf?.['@type'], 'WebSite');
});

test('主要な内部リンクのリンク先が存在する', () => {
  const routes = ['/gogo-submit.html', '/chiiki/', '/docs/manual.html'];
  for (const route of routes) {
    assert.match(ABOUT, new RegExp(`href=["']${route.replaceAll('/', '\\/')}["']`));
    const relative = route.replace(/^\//, '');
    const target = route.endsWith('/')
      ? path.join(ROOT, relative, 'index.html')
      : path.join(ROOT, relative);
    assert.ok(fs.existsSync(target), `${route} のリンク先が存在しません`);
  }
});

test('変動しやすい掲載件数や比較優位を固定表示しない', () => {
  assert.doesNotMatch(ABOUT, /\d{1,3}(?:,\d{3})+(?:会場|例会|団体)/);
  assert.doesNotMatch(ABOUT, /日本一|国内最大|完全網羅/);
});

test('aboutページをsitemapへ重複なく掲載する', () => {
  const escaped = ABOUT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = SITEMAP.match(new RegExp(`<loc>${escaped}</loc>`, 'g')) || [];
  assert.equal(matches.length, 1);
});
