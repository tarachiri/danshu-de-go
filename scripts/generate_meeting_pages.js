#!/usr/bin/env node

// 登録済みの venues.json だけを読み、検索エンジンも読める静的な例会一覧を作る。
// 団体ページは明示的なURLがある場合だけリンクし、名称からの推測はしない。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VENUES_PATH = path.join(ROOT, 'venues.json');
const OUTPUT_ROOT = path.join(ROOT, 'meetings');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://dansyu-go.nukadokonokai.com';
const SITEMAP_START = '  <!-- MEETING-PAGES_START -->';
const SITEMAP_END = '  <!-- MEETING-PAGES_END -->';
const TODAY_JST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const PREFECTURES = [
  ['北海道', 'hokkaido'],
  ['青森県', 'aomori'], ['岩手県', 'iwate'], ['宮城県', 'miyagi'],
  ['秋田県', 'akita'], ['山形県', 'yamagata'], ['福島県', 'fukushima'],
  ['茨城県', 'ibaraki'], ['栃木県', 'tochigi'], ['群馬県', 'gunma'],
  ['埼玉県', 'saitama'], ['千葉県', 'chiba'], ['東京都', 'tokyo'],
  ['神奈川県', 'kanagawa'], ['新潟県', 'niigata'], ['富山県', 'toyama'],
  ['石川県', 'ishikawa'], ['福井県', 'fukui'], ['山梨県', 'yamanashi'],
  ['長野県', 'nagano'], ['岐阜県', 'gifu'], ['静岡県', 'shizuoka'],
  ['愛知県', 'aichi'], ['三重県', 'mie'], ['滋賀県', 'shiga'],
  ['京都府', 'kyoto'], ['大阪府', 'osaka'], ['兵庫県', 'hyogo'],
  ['奈良県', 'nara'], ['和歌山県', 'wakayama'], ['鳥取県', 'tottori'],
  ['島根県', 'shimane'], ['岡山県', 'okayama'], ['広島県', 'hiroshima'],
  ['山口県', 'yamaguchi'], ['徳島県', 'tokushima'], ['香川県', 'kagawa'],
  ['愛媛県', 'ehime'], ['高知県', 'kochi'], ['福岡県', 'fukuoka'],
  ['佐賀県', 'saga'], ['長崎県', 'nagasaki'], ['熊本県', 'kumamoto'],
  ['大分県', 'oita'], ['宮崎県', 'miyazaki'], ['鹿児島県', 'kagoshima'],
  ['沖縄県', 'okinawa'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

function scheduleStatus(dateString) {
  const [todayYear, todayMonth] = TODAY_JST.split('-').map(Number);
  const [year, month] = dateString.split('-').map(Number);
  const monthDistance = (year - todayYear) * 12 + month - todayMonth;
  return monthDistance <= 1 ? 'confirmed' : 'planned';
}

function explicitPetitHpUrl(venue, meeting) {
  return meeting.petit_hp_url || meeting.organization_url || meeting.org_url
    || venue.petit_hp_url || venue.organization_url || venue.org_url || '';
}

function collectMeetings(venues, prefecture) {
  const rows = [];
  for (const venue of venues) {
    if (venue.prefecture !== prefecture) continue;
    for (const meeting of venue.meetings || []) {
      for (const date of [meeting.next_date, meeting.next_date_2]) {
        if (!date || date < TODAY_JST) continue;
        rows.push({
          date,
          venueId: venue.id,
          meetingId: meeting.meeting_id,
          name: meeting.name || venue.meeting_name || '例会',
          facility: venue.facility_name || '',
          address: venue.address || '',
          startTime: meeting.start_time || '',
          endTime: meeting.end_time || '',
          recurrence: meeting.recurrence || '',
          hasException: Boolean(meeting.has_exception),
          exceptionType: meeting.exc_type || '',
          exceptionNote: meeting.exc_note || '',
          petitHpUrl: explicitPetitHpUrl(venue, meeting),
          status: scheduleStatus(date),
        });
      }
    }
  }

  const unique = new Map();
  for (const row of rows) {
    unique.set(`${row.date}:${row.meetingId}:${row.venueId}`, row);
  }
  return [...unique.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.startTime.localeCompare(b.startTime)
    || a.name.localeCompare(b.name, 'ja')
  );
}

function pageShell({ title, description, canonical, relativeRoot, body }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="${relativeRoot}meetings.css">
</head>
<body>
  <header class="site-header"><a href="${relativeRoot}../index.html">断酒でGO!!</a></header>
  ${body}
  <footer>
    <p>例会は変更・中止になる場合があります。参加前に公式情報もご確認ください。</p>
    <p><a href="${relativeRoot}../index.html">地図トップへ戻る</a></p>
  </footer>
</body>
</html>
`.replace(/[ \t]+$/gm, '');
}

function prefectureSelect(availablePrefectures, currentSlug = '', pathPrefix = '') {
  const options = availablePrefectures.map(([name, slug]) =>
    `<option value="${escapeHtml(pathPrefix + slug)}/"${slug === currentSlug ? ' selected' : ''}>${escapeHtml(name)}</option>`
  ).join('');
  return `<label class="prefecture-picker">都道府県を選ぶ
    <select onchange="if(this.value) location.href=this.value">
      <option value="">選択してください</option>
      ${options}
    </select>
  </label>`;
}

function renderMeeting(row) {
  const time = row.startTime
    ? `${escapeHtml(row.startTime)}${row.endTime ? `〜${escapeHtml(row.endTime)}` : '〜'}`
    : '時間は詳細をご確認ください';
  const exception = row.hasException
    ? `<p class="exception">予定変更あり${row.exceptionNote ? `：${escapeHtml(row.exceptionNote)}` : ''}</p>`
    : '';
  const petitHp = row.petitHpUrl
    ? `<a class="button secondary" href="${escapeHtml(row.petitHpUrl)}">プチHP</a>`
    : '';
  const statusLabel = row.status === 'planned'
    ? ' <span class="status planned">予定</span>'
    : '';

  return `<article class="meeting-card">
    <h3>${escapeHtml(row.name)}${statusLabel}</h3>
    <p class="time">${time}</p>
    ${row.facility ? `<p><strong>${escapeHtml(row.facility)}</strong></p>` : ''}
    ${row.address ? `<p class="address">${escapeHtml(row.address)}</p>` : ''}
    ${row.recurrence ? `<p class="recurrence">通常予定：${escapeHtml(row.recurrence)}</p>` : ''}
    ${exception}
    <div class="actions">
      ${petitHp}
      <a class="button" href="../../index.html?venue=${encodeURIComponent(row.venueId)}">地図で詳細を見る</a>
    </div>
  </article>`;
}

function renderPrefecturePage(prefecture, slug, rows, availablePrefectures) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.date)) grouped.set(row.date, []);
    grouped.get(row.date).push(row);
  }
  const sections = [...grouped].map(([date, dateRows]) => `
    <section class="date-section">
      <h2><time datetime="${date}">${formatDate(date)}</time></h2>
      <div class="meeting-list">${dateRows.map(renderMeeting).join('\n')}</div>
    </section>`).join('\n');

  const body = `<main>
    <nav class="breadcrumb"><a href="../">全国の例会一覧</a> &gt; ${escapeHtml(prefecture)}</nav>
    <h1>${escapeHtml(prefecture)}の断酒会・例会予定</h1>
    <p class="lead">登録済みの例会と会場を、次回開催日の早い順に掲載しています。</p>
    <p class="status-guide">翌々月以降の情報には <span class="status planned">予定</span> と表示します。</p>
    ${prefectureSelect(availablePrefectures, slug, '../')}
    <p class="count">掲載予定 ${rows.length}件</p>
    ${sections || '<p class="empty">現在、日付が登録された例会はありません。</p>'}
  </main>`;

  return pageShell({
    title: `${prefecture}の断酒会・例会予定｜断酒でGO!!`,
    description: `${prefecture}で開催予定の断酒会例会を、登録済みデータから日付順に掲載しています。会場と地図の詳細を確認できます。`,
    canonical: `${SITE_URL}/meetings/${slug}/`,
    relativeRoot: '../',
    body,
  });
}

function renderIndex(summary) {
  const links = summary.map(({ prefecture, slug, count }) =>
    `<li><a href="${slug}/">${escapeHtml(prefecture)}の例会予定 <span>${count}件</span></a></li>`
  ).join('');
  const body = `<main>
    <h1>全国の断酒会・例会予定</h1>
    <p class="lead">断酒でGO!!に登録されている例会を、都道府県別・開催日順に探せます。</p>
    ${prefectureSelect(summary.map(row => [row.prefecture, row.slug]))}
    <noscript><p>下の都道府県リンクからお選びください。</p></noscript>
    <section><h2>都道府県から探す</h2><ul class="prefecture-links">${links}</ul></section>
  </main>`;
  return pageShell({
    title: '全国の断酒会・例会予定を都道府県から探す｜断酒でGO!!',
    description: '全国の断酒会例会を都道府県から選び、登録済みの開催予定を日付順に確認できます。',
    canonical: `${SITE_URL}/meetings/`,
    relativeRoot: '',
    body,
  });
}

function updateSitemap(summary) {
  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = [
    { path: '/meetings/', priority: '0.7' },
    ...summary.map(row => ({ path: `/meetings/${row.slug}/`, priority: '0.6' })),
  ];
  const block = [
    SITEMAP_START,
    ...urls.map(url => `  <url>
    <loc>${SITE_URL}${url.path}</loc>
    <lastmod>${TODAY_JST}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${url.priority}</priority>
  </url>`),
    SITEMAP_END,
  ].join('\n');

  const start = sitemap.indexOf(SITEMAP_START);
  const end = sitemap.indexOf(SITEMAP_END);
  if (start !== -1 && end !== -1 && end > start) {
    sitemap = sitemap.slice(0, start) + block + sitemap.slice(end + SITEMAP_END.length);
  } else {
    sitemap = sitemap.replace(/\s*<\/urlset>\s*$/, `\n${block}\n</urlset>\n`);
  }
  fs.writeFileSync(SITEMAP_PATH, sitemap);
}

const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'));
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
const pageData = PREFECTURES
  .map(([prefecture, slug]) => ({ prefecture, slug, rows: collectMeetings(venues, prefecture) }))
  .filter(row => row.rows.length > 0);
const availablePrefectures = pageData.map(row => [row.prefecture, row.slug]);
const summary = [];
for (const { prefecture, slug, rows } of pageData) {
  const dir = path.join(OUTPUT_ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    renderPrefecturePage(prefecture, slug, rows, availablePrefectures)
  );
  summary.push({ prefecture, slug, count: rows.length });
}
fs.writeFileSync(path.join(OUTPUT_ROOT, 'index.html'), renderIndex(summary));
updateSitemap(summary);
console.log(`${summary.length}都道府県・${summary.reduce((sum, row) => sum + row.count, 0)}件を生成`);
