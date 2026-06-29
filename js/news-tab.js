// news-tab.js - 新着タブ (news.json) 表示機能
// app.js から分離 (2026-06)

async function loadNewsTab() {
  const container = document.getElementById('news');
  if (!container) return;
  // 2回目以降は再取得しない（1日1回更新なのでキャッシュでOK）
  if (container.dataset.loaded === '1') return;

  container.innerHTML = '<p class="news-loading">📡 読み込み中...</p>';

  try {
    // キャッシュバスター: 日付単位（1日1回更新に対応）
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`news.json?v=${today}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let html = '';

    // ── イベント・行事セクション ──────────────────────────
    const events = (data.events || []).sort((a, b) => (b.date_from || '').localeCompare(a.date_from || ''));
    if (events.length > 0) {
      html += '<h2 class="news-section-title">📅 イベント・行事</h2>';
      for (const ev of events) {
        html += buildEventCard(ev);
      }
    }

    // ── PDF資料セクション ────────────────────────────────
    const pdfs = (data.pdfs || []).sort((a, b) => (b.found_at || '').localeCompare(a.found_at || ''));
    if (pdfs.length > 0) {
      html += '<h2 class="news-section-title">📄 PDF資料・お知らせ</h2>';
      for (const pdf of pdfs) {
        html += buildPdfCard(pdf);
      }
    }

    // ── 最新ニュース（RSS）セクション ────────────────────
    const news = (data.news || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (news.length > 0) {
      html += '<h2 class="news-section-title">📢 各断酒会からの新着情報</h2>';
      for (const n of news) {
        html += buildNewsCard(n);
      }
    }

    // 何もなければメッセージ
    if (!html) {
      html = '<p class="news-empty">現在お知らせはありません</p>';
    }

    // 更新日時フッター
    if (data.generated_at) {
      const dt = new Date(data.generated_at);
      const label = `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')} 更新`;
      html += `<p class="news-updated">最終更新: ${label}</p>`;
    }

    container.innerHTML = html;
    container.dataset.loaded = '1';

  } catch (e) {
    console.error('loadNewsTab error:', e);
    container.innerHTML = '<p class="news-error">⚠️ 情報の読み込みに失敗しました</p>';
  }
}

function buildEventCard(ev) {
  const dateStr = ev.date_to && ev.date_to !== ev.date_from
    ? `${formatNewsDate(ev.date_from)} 〜 ${formatNewsDate(ev.date_to)}`
    : formatNewsDate(ev.date_from);

  const badge = `<span class="news-badge news-badge-event">${ev.category || 'イベント'}</span>`;
  const pref  = ev.prefecture ? `<span class="news-pref">${ev.prefecture}</span>` : '';
  const venue = ev.venue ? `📍 ${ev.venue}` : '';

  return `
<div class="news-card">
  <div class="news-card-header">
    ${badge}${pref}
  </div>
  <a class="news-card-title" href="${ev.url}" target="_blank" rel="noopener">
    ${escapeHtml(ev.title)}
  </a>
  <div class="news-card-meta">
    📅 ${dateStr}　${venue}
  </div>
  <div class="news-card-source">出典: ${ev.source || 'ソーバーねっと'}</div>
</div>`;
}

function buildPdfCard(pdf) {
  const badge = `<span class="news-badge news-badge-pdf">📄 PDF</span>`;
  const pref  = pdf.prefecture ? `<span class="news-pref">${pdf.prefecture}</span>` : '';
  const found = pdf.found_at ? `取得: ${formatNewsDate(pdf.found_at)}` : '';

  return `
<div class="news-card news-card-pdf">
  <div class="news-card-header">
    ${badge}${pref}
  </div>
  <a class="news-card-title" href="${pdf.url}" target="_blank" rel="noopener">
    ${escapeHtml(pdf.title)}
  </a>
  <div class="news-card-meta">
    🏢 ${escapeHtml(pdf.org || '')}　${found}
  </div>
</div>`;
}

function buildNewsCard(n) {
  const badge = `<span class="news-badge news-badge-news">🆕 新着</span>`;
  const pref  = n.prefecture ? `<span class="news-pref">${n.prefecture}</span>` : '';
  const date  = n.date ? `📅 ${formatNewsDate(n.date)}` : '';

  return `
<div class="news-card">
  <div class="news-card-header">
    ${badge}${pref}
  </div>
  <a class="news-card-title" href="${n.url}" target="_blank" rel="noopener">
    ${escapeHtml(n.title)}
  </a>
  <div class="news-card-meta">
    🏢 ${escapeHtml(n.org || '')}　${date}
  </div>
</div>`;
}

function formatNewsDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
