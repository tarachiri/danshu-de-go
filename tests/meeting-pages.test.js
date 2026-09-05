// tests/meeting-pages.test.js
// 都道府県別一覧が登録データと日付表示の方針から外れないための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MEETINGS_ROOT = path.join(ROOT, 'meetings');
const INDEX_HTML = fs.readFileSync(path.join(MEETINGS_ROOT, 'index.html'), 'utf8');
const VENUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'venues.json'), 'utf8'));
const TODAY = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function monthDistance(date) {
  const [todayYear, todayMonth] = TODAY.split('-').map(Number);
  const [year, month] = date.split('-').map(Number);
  return (year - todayYear) * 12 + month - todayMonth;
}

test('全国入口の都道府県リンクは実在する生成ページだけを指す', () => {
  const links = [...INDEX_HTML.matchAll(/<li><a href="([^/]+)\/">([^<]+)の例会予定/g)];
  assert.ok(links.length > 0);
  for (const [, slug] of links) {
    assert.ok(fs.existsSync(path.join(MEETINGS_ROOT, slug, 'index.html')), `${slug} がありません`);
  }
});

test('都道府県ページは過去日を載せず、翌々月以降だけ予定と表示する', () => {
  const pages = fs.readdirSync(MEETINGS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => fs.readFileSync(path.join(MEETINGS_ROOT, entry.name, 'index.html'), 'utf8'));
  for (const html of pages) {
    assert.doesNotMatch(html, />確定</);
    const cards = [...html.matchAll(/<section class="date-section">([\s\S]*?)(?=<section class="date-section">|<\/main>)/g)];
    for (const [, section] of cards) {
      const date = section.match(/datetime="([0-9-]+)"/)[1];
      assert.ok(date >= TODAY, `${date} は過去日です`);
      const meetingCount = (section.match(/class="meeting-card"/g) || []).length;
      const plannedCount = (section.match(/<span class="status planned">予定<\/span>/g) || []).length;
      assert.equal(plannedCount, monthDistance(date) >= 2 ? meetingCount : 0);
    }
  }
});

test('すべての地図詳細リンクが登録済み会場を指す', () => {
  const venueIds = new Set(VENUES.map(venue => String(venue.id)));
  const pages = fs.readdirSync(MEETINGS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  let linkCount = 0;
  for (const page of pages) {
    const html = fs.readFileSync(path.join(MEETINGS_ROOT, page.name, 'index.html'), 'utf8');
    for (const match of html.matchAll(/href="\.\.\/\.\.\/index\.html\?venue=([0-9]+)"/g)) {
      linkCount += 1;
      assert.ok(venueIds.has(match[1]), `会場ID ${match[1]} がありません`);
    }
  }
  assert.ok(linkCount > 0);
});

test('プチHPリンクは公開データに明示されたURLだけを使用する', () => {
  const allowed = new Set();
  for (const venue of VENUES) {
    for (const meeting of venue.meetings || []) {
      if (meeting.petit_hp_url) allowed.add(meeting.petit_hp_url);
    }
  }
  for (const page of fs.readdirSync(MEETINGS_ROOT, { withFileTypes: true })) {
    if (!page.isDirectory()) continue;
    const html = fs.readFileSync(path.join(MEETINGS_ROOT, page.name, 'index.html'), 'utf8');
    for (const match of html.matchAll(/class="button secondary" href="([^"]+)">プチHP<\/a>/g)) {
      assert.ok(allowed.has(match[1]), `未確認のプチHP URLです: ${match[1]}`);
    }
  }
});

test('トップページから全国の例会一覧へ移動できる', () => {
  const top = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(top, /href="\/meetings\/"/);
});

test('生成された例会ページがサイトマップへ重複なく掲載される', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const pages = fs.readdirSync(MEETINGS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  for (const page of pages) {
    const url = `https://dansyu-go.nukadokonokai.com/meetings/${page.name}/`;
    assert.equal(sitemap.split(url).length - 1, 1, `${url} の掲載数が不正です`);
  }
  assert.equal(
    sitemap.split('https://dansyu-go.nukadokonokai.com/meetings/</loc>').length - 1,
    1
  );
});
