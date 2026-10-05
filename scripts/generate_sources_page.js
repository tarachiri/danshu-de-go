#!/usr/bin/env node
// 公開済みvenues.jsonだけから情報源一覧を生成する。
// national_sourcesには電話番号や内部確認用データが含まれるため、公開ページへ直接出力しない。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VENUES_PATH = path.join(ROOT, 'venues.json');
const OUTPUT_DIR = path.join(ROOT, 'sources');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'index.html');

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

const PREFECTURE_SLUGS = {
  '北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima',
  '茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa',
  '新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano','岐阜県':'gifu',
  '静岡県':'shizuoka','愛知県':'aichi','三重県':'mie','滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo',
  '奈良県':'nara','和歌山県':'wakayama','鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi',
  '徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi','福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki',
  '熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima','沖縄県':'okinawa',
};

const TYPE_LABELS = {
  official: '公式サイト',
  calendar: '公式カレンダー',
  official_calendar: '公式カレンダー',
  official_pdf: '公式予定表・PDF',
  official_site: '公開情報の参照元',
  submitted: '提供情報の確認先',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizePublicUrl(raw) {
  if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw.trim())) return null;
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === '/' && !url.search) url.pathname = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function sourceLabel(types) {
  const labels = [...types].map(type => TYPE_LABELS[type] || '公開情報の参照元');
  return [...new Set(labels)].join('・');
}

function collectSources(venues) {
  const byPrefecture = new Map(PREFECTURES.map(prefecture => [prefecture, new Map()]));

  function add(prefecture, rawUrl, type) {
    if (!byPrefecture.has(prefecture)) return;
    const url = normalizePublicUrl(rawUrl);
    if (!url) return;
    const sources = byPrefecture.get(prefecture);
    if (!sources.has(url)) sources.set(url, new Set());
    sources.get(url).add(type);
  }

  for (const venue of venues) {
    add(venue.prefecture, venue.official_url, 'official');
    add(venue.prefecture, venue.calendar_url, 'calendar');
    for (const meeting of venue.meetings || []) {
      add(venue.prefecture, meeting.date_source_url, meeting.date_source_type || 'official_site');
    }
  }

  return byPrefecture;
}

function renderSourceList(sources) {
  if (sources.size === 0) {
    return '<p class="empty">公開できる情報源URLは現在整理中です。例会情報がないという意味ではありません。</p>';
  }
  return `<ul class="source-list">${[...sources.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([url, types]) => {
      const safeUrl = escapeHtml(url);
      return `<li><span class="source-type">${escapeHtml(sourceLabel(types))}</span><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></li>`;
    }).join('')}</ul>`;
}

function renderPage(byPrefecture) {
  const totalSources = new Set([...byPrefecture.values()].flatMap(sources => [...sources.keys()])).size;
  const navigation = PREFECTURES.map(prefecture =>
    `<li><a href="#${PREFECTURE_SLUGS[prefecture]}">${prefecture}</a></li>`
  ).join('');
  const sections = PREFECTURES.map(prefecture => {
    const sources = byPrefecture.get(prefecture);
    return `<section class="prefecture" id="${PREFECTURE_SLUGS[prefecture]}">
      <h2>${prefecture}</h2>
      ${renderSourceList(sources)}
      <p class="pref-links"><a href="/meetings/${PREFECTURE_SLUGS[prefecture]}/">${prefecture}の例会予定を見る</a></p>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>例会情報の出典・確認先｜断酒でGO!!</title>
  <meta name="description" content="断酒でGO!!が全国の断酒会・例会情報を整理する際に参照している公式サイト、公式カレンダー、公開予定表を都道府県別に案内します。">
  <link rel="canonical" href="https://dansyu-go.nukadokonokai.com/sources/">
  <meta property="og:title" content="例会情報の出典・確認先｜断酒でGO!!">
  <meta property="og:description" content="断酒会・例会情報の主な参照元を都道府県別に確認できます。">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://dansyu-go.nukadokonokai.com/sources/">
  <style>
    :root{color-scheme:light;--navy:#16213e;--red:#9b2c22;--bg:#f6f7f9;--ink:#222;--muted:#5d6470;--line:#dfe3e8}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;line-height:1.75}
    header{background:var(--navy);padding:12px 16px}header a{color:#fff;font-weight:700;text-decoration:none}main{width:min(960px,calc(100% - 24px));margin:24px auto 48px}.panel,.prefecture{background:#fff;border-radius:12px;padding:clamp(18px,4vw,32px);box-shadow:0 3px 16px rgba(22,33,62,.07)}
    h1{margin:0;font-size:clamp(26px,6vw,38px);line-height:1.35}h2{margin:0 0 12px;font-size:24px;border-bottom:2px solid var(--line)}a{color:var(--red);overflow-wrap:anywhere}.lead,.note,.empty{color:var(--muted)}.note{background:#fff7df;border-left:5px solid #d49a00;padding:12px 16px}
    .pref-nav ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;padding:0;list-style:none}.pref-nav a{display:block;padding:7px;text-align:center;border:1px solid var(--line);border-radius:8px;text-decoration:none}.summary{font-weight:700}.prefecture{margin-top:16px;scroll-margin-top:12px}.source-list{padding-left:1.25rem}.source-list li+li{margin-top:12px}.source-type{display:block;color:var(--muted);font-size:.88rem;font-weight:700}.pref-links{margin:18px 0 0}.pref-links a{font-weight:700}footer{text-align:center;color:var(--muted);padding:0 16px 32px;font-size:14px}
  </style>
</head>
<body>
  <header><a href="/">← マップへ戻る</a></header>
  <main>
    <section class="panel">
      <h1>例会情報の出典・確認先</h1>
      <p class="lead">断酒でGO!!が例会場や開催予定を整理する際に参照している、公開情報のリンクを都道府県別に掲載しています。</p>
      <p class="summary">現在、公開データから確認できる参照先：${totalSources}件</p>
      <p class="note"><strong>参加前に最新情報をご確認ください。</strong><br>ここに掲載するリンクは情報収集時の参照先です。リンク先の内容や例会予定は変更されることがあります。また、断酒でGO!!は各団体の公式サイトではありません。</p>
      <p>電話番号、投稿者情報、内部確認メモ、未確認の候補URLはこのページに掲載しません。情報源の追加・訂正は<a href="/gogo-submit.html">情報提供フォーム</a>からお知らせください。</p>
      <nav class="pref-nav" aria-label="都道府県の情報源"><ul>${navigation}</ul></nav>
    </section>
    ${sections}
  </main>
  <footer><a href="/about.html">運営方針</a> ／ © 2026 ぬか床の会</footer>
</body>
</html>
`;
}

function main() {
  const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'));
  if (!Array.isArray(venues)) throw new Error('venues.jsonの形式が配列ではありません');
  const byPrefecture = collectSources(venues);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, renderPage(byPrefecture), 'utf8');
  const sourceCount = new Set([...byPrefecture.values()].flatMap(sources => [...sources.keys()])).size;
  console.log(`SOURCES_PAGE_OK prefectures=${PREFECTURES.length} unique_sources=${sourceCount}`);
}

if (require.main === module) main();

module.exports = { collectSources, normalizePublicUrl, renderPage };
