const map = window._leafletMap = L.map('map', {zoomControl: false}).setView([35.68, 139.60], 9);
// JSTで今日の日付文字列を返すヘルパー
function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}
function getTomorrowJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 + 24) * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const TODAY    = getTodayJST();
const TOMORROW = getTomorrowJST();
const DAY_AFTER= new Date(new Date().getTime() + (9 + 48) * 60 * 60 * 1000).toISOString().split('T')[0];
// エリアカラー（その他用）
const AREA_COLORS = {
  '東京都':  '#1A5276',
  '埼玉県':  '#1E8449',
  '神奈川県':'#6C3483',
  '山梨県':  '#7D6608',
  '千葉県':  '#6E2C2C',
};

// 日付ラベル
function getDateLabel(next_date) {
  if (!next_date) return 'none';
  if (next_date === TODAY)     return 'today';
  if (next_date === TOMORROW)  return 'tomorrow';
  if (next_date === DAY_AFTER) return 'dayafter';
  return 'other';
}

// ピンスタイル
function getStyle(v) {
  const label = getDateLabel(v.next_date);
  if (label === 'today')    return { color: '#C0392B', size: 28, cls: 'pin-today' };
  if (label === 'tomorrow') return { color: '#D35400', size: 26, cls: '' };
  if (label === 'dayafter') return { color: '#E8857A', size: 21, cls: '' };
  // その他→エリアカラー
  const areaColor = (v.meetings && v.meetings.length > 0)
    ? (AREA_COLORS[v.prefecture] || '#555')
    : '#5DADE2';
  return { color: areaColor, size: 15, cls: '' };
}

function makeIcon(v) {
  const s = getStyle(v);
  return L.divIcon({
    html: `<div class="${s.cls}" style="
      width:${s.size}px;height:${s.size}px;
      background:${s.color};
      border:2px solid rgba(255,255,255,0.8);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [s.size, s.size],
    iconAnchor: [s.size/2, s.size],
    popupAnchor: [0, -s.size],
    className: ''
  });
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const label = getDateLabel(d);
  const labelStr = {today:'今日', tomorrow:'明日', dayafter:'明後日'}[label] || '';
  const mm = dt.getMonth()+1;
  const dd = dt.getDate();
  const day = ['日','月','火','水','木','金','土'][dt.getDay()];
  return labelStr ? `${labelStr}（${mm}/${dd} ${day}曜）` : `${mm}/${dd}（${day}曜）`;
}

function buildPopup(v) {
  // ── 定数 ──────────────────────────────────────────
  const badgeColors = {
    today:     '#C0392B',
    tomorrow:  '#D35400',
    dayafter:  '#9A7D0A',
    other:     '#555',
    none:      '#888',
    exception: '#C0392B',
    cancel:    '#7D3C00'
  };
  const badgeTexts = {
    today:     '今日開催！',
    tomorrow:  '明日開催',
    dayafter:  '明後日開催',
    other:     '開催予定あり',
    none:      '日程未定',
    exception: '⚠️ 要確認',
    cancel:    '⚠️ 中止あり'
  };

  // 例会タイプアイコン（通常・空は表示なし）
  const typeEmoji = {
    'シングル':   '🔵',
    'アメシスト': '💜',
    '家族':       '👨‍👩‍👧',
    '相談':       '💬',
    '本部':       '🏛️'
  };

  // ── 住所整形 ───────────────────────────────────────
  let addr = v.address || '';
  addr = addr.replace(/^.*〒\d{3}-\d{4}\s*/, '').replace(/,?\s*日本.*$/, '').trim();

  // ── meetings 配列を取得（なければフォールバック） ──
  const meetings = (v.meetings && v.meetings.length > 0) ? v.meetings : null;

  // ── 大見出し：直近例会名（meetings[0] or フォールバック） ──
  let headName, headEmoji, headLabel;
  if (meetings) {
    const first = meetings[0];
    headName  = first.name || v.facility_name || '例会場';
    headEmoji = typeEmoji[first.meeting_type] || '';
    // 大見出しバッジ：has_exception か next_date で判定
    if (first.has_exception) {
      headLabel = first.exc_type === 'cancel' ? 'cancel' : 'exception';
    } else {
      headLabel = getDateLabel(first.next_date);
    }
  } else {
    // フォールバック（meetings未リンク）
    headName  = v.fallback_meeting_name || v.facility_name || '例会場';
    headEmoji = '';
    headLabel = v.has_exception
      ? 'exception'
      : getDateLabel(v.fallback_next_date || v.next_date);
  }

  // ── Googleカレンダーリンク（会場単位） ───────────
  const calLink = v.calendar_url
    ? `<a href="${v.calendar_url}" target="_blank" class="popup-link" style="background:#27AE60;color:#fff">📅 公式<br>カレンダー</a>`
    : '';

  // ── Google Maps経路リンク（会場単位） ────────────
  const mapsQuery = encodeURIComponent(addr || v.facility_name || '');
  const mapsLink = mapsQuery
    ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}" target="_blank" class="popup-link map-link" style="color:#000">🗺️経路を<br>調べる</a>`
    : '';

  // ── needs_verification 警告（会場単位） ──────────
  let verifyNotice = '';
  if (Number(v.needs_verification) === 1) {
    const url = v.official_url || '';
    const isAozora = headName === 'あおぞら例会';
    const msg = isAozora
      ? 'この例会は季節や天候により開催地が変わる場合があります。'
      : 'この例会の日程は変更になる場合があります。';
    const urlLine = url
      ? `<a href="${url}" target="_blank" rel="noopener" class="verify-link">公式サイト</a>`
      : '';
    verifyNotice = `<div class="popup-verify">⚠️ ${msg}${urlLine ? urlLine + 'で要確認' : '事前に確認を'}</div>`;
  }

  // ── 例会カード生成 ────────────────────────────────
  let meetingsHTML = '';
  if (meetings) {
    meetingsHTML = meetings.map(m => {
      // カードごとバッジ
      let cardLabel;
      if (m.has_exception) {
        cardLabel = m.exc_type === 'cancel' ? 'cancel' : 'exception';
      } else {
        cardLabel = getDateLabel(m.next_date);
      }
      const cardColor = badgeColors[cardLabel] || '#555';
      const cardText  = badgeTexts[cardLabel]  || '開催予定あり';
      const mEmoji    = typeEmoji[m.meeting_type] || '';

      // 日付・時刻
      const timeStr = m.start_time ? `${m.start_time}〜${m.end_time || ''}` : '';
      const dateStr = formatDate(m.next_date);

      // ⚠️ 例外ノート（カードごと）
      const excNote = (m.has_exception && m.exc_note)
        ? `<div class="popup-exception-note">📢 ${m.exc_note}</div>`
        : '';

      return `
        <div class="meeting-card">
          <div class="meeting-card-header">
            <span class="popup-badge" style="background:${cardColor};font-size:11px;padding:2px 7px;">${cardText}</span>
            <span class="meeting-card-name">${mEmoji ? mEmoji + ' ' : ''}${m.name}</span>
          </div>
          ${!m.has_exception && dateStr ? `<div class="popup-date" style="color:${cardColor}">📅 ${dateStr} ${timeStr}</div>` : ''}
          ${!m.has_exception && m.recurrence ? `<div class="popup-recurrence">🔁 ${m.recurrence}</div>` : ''}
          ${excNote}
        </div>`;
    }).join('');
  } else {
    // フォールバック表示（meetings未リンク）
    const fbTime = v.start_time ? `${v.start_time}〜${v.end_time || ''}` : '';
    const fbDate = formatDate(v.fallback_next_date || v.next_date);
    meetingsHTML = `
      <div class="meeting-card">
        <div class="popup-date" style="color:${badgeColors[headLabel]}">
          ${fbDate ? `📅 ${fbDate} ${fbTime}` : '📅 日程未定'}
        </div>
        ${v.fallback_schedule ? `<div class="popup-recurrence">🔁 ${v.fallback_schedule}</div>` : ''}
      </div>`;
  }

  // ── ポップアップ組み立て ──────────────────────────
  return `
    <div class="popup-box">
      <span class="popup-badge ${headLabel === 'exception' || headLabel === 'cancel' ? 'exception-badge' : ''}"
            style="background:${badgeColors[headLabel]}">${badgeTexts[headLabel]}</span>
      <div class="popup-name">🏢 ${v.facility_name || headName}${meetings && meetings.length > 1 ? '<span class="meeting-count-badge">' + meetings.length + '件</span>' : ''}</div>
      ${addr ? `<div class="popup-address">📍 ${addr}</div>` : ''}
      ${verifyNotice}
      <div class="meetings-list">
        ${meetingsHTML}
      </div>
      <div class="popup-links" style="flex-shrink:0">
        ${calLink}
        ${mapsLink}
      </div>
    </div>
  `;
}


// 座標から最寄りマーカーを探す（id不一致時のフォールバック）
function findMarkerByCoords(lat, lng) {
  let best = null, bestD = Infinity;
  const ms = window._markers || {};
  for (const key in ms) {
    const ll = ms[key].getLatLng();
    const d = Math.abs(ll.lat - lat) + Math.abs(ll.lng - lng);
    if (d < bestD) { bestD = d; best = ms[key]; }
  }
  return bestD < 0.001 ? best : null;
}

// マーカージャンプ
function jumpToMarker(id, lat, lng, name) {
  if (!lat || !lng) return;
  switchTab('map');
  currentMode = 'explore';
  const mBtn = document.getElementById('menu-toggle-float');
  if (mBtn) mBtn.style.background = '#27AE60';
  document.getElementById('area-filter').value = 'all';
  document.getElementById('date-filter').value = 'all';
  applyFilters();
  setTimeout(() => {
    if (window._leafletMap) {
      const point = window._leafletMap.latLngToContainerPoint([lat, lng]);
      const newPoint = window._leafletMap.containerPointToLatLng([point.x, point.y - 150]);
      window._leafletMap.flyTo(newPoint, 15, {duration: 0.8});
      window._leafletMap.once('moveend', () => {
        const m = (window._markers && window._markers[id]) || findMarkerByCoords(lat, lng);
        if (m) {
          clusterGroup.zoomToShowLayer(m, () => {
            m.openPopup();
            const mapHeight = window._leafletMap.getSize().y;
            const markerPoint = window._leafletMap.latLngToContainerPoint([lat, lng]);
            const targetY = mapHeight * 0.75;
            const offset = markerPoint.y - targetY;
            window._leafletMap.panBy([0, offset]);
          });
        } else if (name) {
          L.popup().setLatLng([lat, lng]).setContent('<b>' + name + '</b>').openOn(window._leafletMap);
        }
      });
    }
  }, 300);
}

// タブ切替
function switchTab(tab) {
  const mapEl = document.getElementById('map');
  const schEl = document.getElementById('schedule');
  const newsEl = document.getElementById('news');
  const tabMap = document.getElementById('tab-map');
  const tabSch = document.getElementById('tab-schedule');
  const tabNews = document.getElementById('tab-news');
  mapEl.style.display = 'none';
  schEl.style.display = 'none';
  if (newsEl) newsEl.style.display = 'none';
  tabMap.classList.remove('active');
  tabSch.classList.remove('active');
  if (tabNews) tabNews.classList.remove('active');
  if (tab === 'map') {
    mapEl.style.display = '';
    tabMap.classList.add('active');
    if (window._leafletMap) window._leafletMap.invalidateSize();
  } else if (tab === 'schedule') {
    schEl.style.display = 'block';
    tabSch.classList.add('active');
    renderSchedule();
  } else if (tab === 'news') {
    if (newsEl) newsEl.style.display = 'block';
    if (tabNews) tabNews.classList.add('active');
    renderNews();
  }
}

const DATE_LABELS_SCH = { "2026-06-08":"6月8日（月）","2026-06-09":"6月9日（火）","2026-06-10":"6月10日（水）","2026-06-11":"6月11日（木）","2026-06-12":"6月12日（金）" };
const PREF_LABEL_SCH = { tokyo:"東京", saitama:"埼玉", kanagawa:"神奈川", chiba:"千葉" };
const PREF_CLASS_SCH = { tokyo:"pref-tokyo", saitama:"pref-saitama", kanagawa:"pref-kanagawa", chiba:"pref-chiba" };
const SCH_TODAY = getTodayJST();

let _schRendered = false;
function renderSchedule() {
  if (_schRendered) return;
  _schRendered = true;
  const container = document.getElementById('schedule');
  container.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">読み込み中...</div>';
  fetch('schedule.json?v=' + Date.now())
    .then(r => r.json())
    .then(data => {
      const byDate = {};
      data.forEach(e => {
        const d = e.next_date;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(e);
      });
  let html = '';
  Object.keys(byDate).sort().forEach(date => {
    const evs = byDate[date];
    const isToday = date === SCH_TODAY;
    const label = date.replace(/^\d{4}-/, '').replace('-', '/') + '（' + ['日','月','火','水','木','金','土'][new Date(date + 'T00:00:00+09:00').getDay()] + '）';
    html += `<div class="sch-date-header"><span>${label}</span>${isToday?'<span class="sch-date-today">今日</span>':''}<span class="sch-date-count">${evs.length}件</span></div>`;
    evs.forEach(e => {
      const pref = e.prefecture === '東京都' ? 'tokyo' : e.prefecture === '埼玉県' ? 'saitama' : e.prefecture === '神奈川県' ? 'kanagawa' : 'chiba';
      const clickAttr = (e.latitude && e.longitude) ? ` onclick="jumpToMarker(${e.id}, ${e.latitude}, ${e.longitude}, '${(e.meeting_name || '').replace(/['"]/g, '')}')" style="cursor:pointer;"` : '';
      html += `<div class="sch-card"${clickAttr}><div class="sch-time"><div class="sch-time-start">${e.start_time||''}</div><div class="sch-time-end" style="font-size:14px;color:#888;">${e.end_time||''}</div></div><div class="sch-info"><div class="sch-name">${e.meeting_name}</div><div class="sch-loc">📍 ${e.address||''}</div></div><span class="sch-pref-badge ${PREF_CLASS_SCH[pref]}">${PREF_LABEL_SCH[pref]}</span></div>`;
    });
  });
  container.innerHTML = html;
    })
    .catch(() => { container.innerHTML = '<div style="color:#e94560;text-align:center;padding:32px;">取得エラー</div>'; });
}

let VENUES = [];
let clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 10,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 14
});
map.addLayer(clusterGroup);

// popupopen: LeafletのmaxHeightを解除
map.on('popupopen', function(e) {
  const el = e.popup.getElement();
  if (!el) return;
  const content = el.querySelector('.leaflet-popup-content');
  if (content) {
    content.style.maxHeight = '';
    content.style.overflow = '';
  }
});
let comfortGroup = L.layerGroup();
let currentMode = 'comfort';

function initVenues() {
  const totalEl = document.getElementById('count-total-header');
  if (totalEl) totalEl.textContent = '...';
  fetch('venues.json?v=' + Date.now())
    .then(r => {
      const lm = r.headers.get('Last-Modified');
      if(lm){
        const d = new Date(lm);
        const label = d.getFullYear()+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getDate()).padStart(2,"0");
        const f = document.getElementById("footer-updated");
        if(f) f.textContent = "更新: "+label;
      }
      return r.json();
    })
    .then(data => {
      VENUES = data;
      applyFilters();
      const ls = document.getElementById("loading-screen");
      if(ls) ls.style.display="none";
    })
    .catch(() => {
      const totalEl2 = document.getElementById('count-total-header');
      if (totalEl2) totalEl2.textContent = '!';
    });
}

function showInstallGuide() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;';
  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1a1a2e;color:#fff;padding:24px;width:100%;border-top:3px solid #C0392B;border-radius:16px 16px 0 0;';
  if(isIOS){
    modal.innerHTML = `
      <div style="font-size: 20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size: 18px;line-height:2;color:#ccc;">
        ① 下のメニューバーの <b style="color:#fff;">「共有」</b> をタップ<br>
        ② <b style="color:#fff;">「ホーム画面に追加」</b> を選択<br>
        ③ 右上の <b style="color:#fff;">「追加」</b> をタップ
      </div>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:16px;width:100%;padding:12px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size: 19px;font-weight:bold;">閉じる</button>
    `;
  } else if(isAndroid){
    modal.innerHTML = `
      <div style="font-size: 20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size: 18px;line-height:2;color:#ccc;">
        ① ブラウザ右上の <b style="color:#fff;">メニュー（⋮）</b> をタップ<br>
        ② <b style="color:#fff;">「ホーム画面に追加」</b> を選択
      </div>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:16px;width:100%;padding:12px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size: 19px;font-weight:bold;">閉じる</button>
    `;
  } else {
    modal.innerHTML = `
      <div style="font-size: 20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size: 18px;color:#ccc;">スマートフォンでアクセスしてホーム画面に追加してください！</div>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:16px;width:100%;padding:12px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size: 19px;font-weight:bold;">閉じる</button>
    `;
  }
  overlay.appendChild(modal);
  overlay.onclick = function(e) { if(e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function setMode(mode) {
  currentMode = mode;
  applyFilters();
  const btn = document.getElementById('menu-toggle-float');
  if (btn) {
    btn.style.background = mode === 'explore' ? '#27AE60' : '#C0392B';
  }
}

function applyFilters() {
  const dateFilter = document.getElementById('date-filter').value;
  const areaFilter = document.getElementById('area-filter').value;

  // モードに応じてアクティブレイヤーを切替
  const activeGroup = currentMode === 'comfort' ? comfortGroup : clusterGroup;
  clusterGroup.clearLayers();
  comfortGroup.clearLayers();
  if (currentMode === 'comfort') {
    if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
    if (!map.hasLayer(comfortGroup)) map.addLayer(comfortGroup);
  } else {
    if (map.hasLayer(comfortGroup)) map.removeLayer(comfortGroup);
    if (!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
  }
  window._markers = {};

  let count = 0;
  VENUES.forEach(v => {
    if (!v.lat || !v.lng) return;

    const label = getDateLabel(v.next_date);

    // モード判定
    if (currentMode === 'comfort' && label === 'none') return;
    if (currentMode === 'comfort' && label === 'other') return;

    // 日付フィルター
    if (dateFilter !== 'all' && label !== dateFilter) return;

    // エリアフィルター
    if (areaFilter !== 'all' && v.prefecture !== areaFilter) return;

    const marker = L.marker([v.lat, v.lng], { icon: makeIcon(v) })
      .bindPopup(buildPopup(v), { maxWidth: 300 });

    activeGroup.addLayer(marker);
    window._markers[v.id] = marker;
    count++;
  });


let todayCount=0, tomorrowCount=0, dayafterCount=0;
  VENUES.forEach(v => {
    const l = getDateLabel(v.next_date);
    if(l==='today') todayCount++;
    else if(l==='tomorrow') tomorrowCount++;
    else if(l==='dayafter') dayafterCount++;
  });
  document.getElementById('count-today').textContent = todayCount;
  document.getElementById('count-tomorrow').textContent = tomorrowCount;
  document.getElementById('count-dayafter').textContent = dayafterCount;
  const totalMeetings = VENUES.reduce((sum, v) => sum + (v.meetings ? v.meetings.length : 0), 0);
  const headerEl = document.getElementById('count-total-header');
  if (headerEl) headerEl.textContent = totalMeetings;
}

initVenues();


// ===== カスタム縦ズームスライダー =====
(function initZoomSlider() {
  const MIN_ZOOM = 5;
  const MAX_ZOOM = 18;

  const container = document.createElement('div');
  container.id = 'zoom-slider-container';
  container.style.cssText = `
    position: fixed;
    bottom: 140px;
    right: 72px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  `;

  const plusBtn = document.createElement('button');
  plusBtn.innerHTML = '+';
  plusBtn.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(26,26,46,0.85);
    color: #fff;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    line-height: 1;
  `;
  plusBtn.addEventListener('click', () => map.zoomIn());

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'zoom-slider';
  slider.min = MIN_ZOOM;
  slider.max = MAX_ZOOM;
  slider.value = map.getZoom();
  slider.style.cssText = `
    writing-mode: vertical-lr;
    direction: rtl;
    width: 32px;
    height: 120px;
    cursor: pointer;
    accent-color: #C0392B;
  `;

  const minusBtn = document.createElement('button');
  minusBtn.innerHTML = '−';
  minusBtn.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(26,26,46,0.85);
    color: #fff;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    line-height: 1;
  `;
  minusBtn.addEventListener('click', () => map.zoomOut());

  slider.addEventListener('input', () => {
    map.setZoom(parseInt(slider.value));
  });

  map.on('zoomend', () => {
    slider.value = map.getZoom();
  });

  container.appendChild(plusBtn);
  container.appendChild(slider);
  container.appendChild(minusBtn);
  document.body.appendChild(container);
})();

// ===== ハンバーガーメニューボタン =====
(function initMenuButton() {
  const btn = document.createElement('button');
  btn.id = 'menu-toggle-float';
  btn.innerHTML = '☰ メニュー';
  btn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 16px;
    z-index: 1000;
    padding: 12px 20px;
    border-radius: 24px;
    border: none;
    background: #C0392B;
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  const panel = document.createElement('div');
  panel.id = 'menu-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 130px;
    right: 16px;
    z-index: 999;
    background: #1a1a2e;
    border: 1px solid #0f3460;
    border-radius: 16px;
    padding: 8px 0;
    min-width: 200px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    display: none;
  `;

  const menuItems = [
    { icon: '📲', label: 'ホーム画面に追加', action: () => { closeMenu(); showInstallGuide(); } },
    { icon: '🗺️', label: '快適モード', action: () => { closeMenu(); setMode('comfort'); } },
    { icon: '🔍', label: '探索モード', action: () => { closeMenu(); setMode('explore'); } },
    { icon: '📖', label: 'マニュアル', action: null },
    { icon: '❓', label: 'FAQ', action: null },
    { icon: '🤖', label: 'AIモード（実装予定）', action: null, disabled: true },
  ];

  menuItems.forEach(item => {
    const el = document.createElement('div');
    el.style.cssText = `
      padding: 12px 20px;
      color: ${item.disabled ? '#555' : '#fff'};
      font-size: 16px;
      cursor: ${item.action ? 'pointer' : 'default'};
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #0f3460;
    `;
    el.innerHTML = `${item.icon} ${item.label}`;
    if (item.action) {
      el.addEventListener('click', item.action);
      el.addEventListener('mouseenter', () => el.style.background = '#0f3460');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    }
    panel.appendChild(el);
  });

  panel.lastChild.style.borderBottom = 'none';

  let menuOpen = false;
  function closeMenu() {
    menuOpen = false;
    panel.style.display = 'none';
    btn.innerHTML = '☰ メニュー';
  }

  btn.addEventListener('click', () => {
    menuOpen = !menuOpen;
    panel.style.display = menuOpen ? 'block' : 'none';
    btn.innerHTML = menuOpen ? '✕ 閉じる' : '☰ メニュー';
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      closeMenu();
    }
  });

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();

// ===== Service Worker登録（index.htmlインラインから移設） =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ===== シェアバー（index.htmlインラインから移設） =====
const SITE_URL = 'https://dansyu-go.nukadokonokai.com';
const SITE_TEXT = '🏃断酒でGO！今日・明日の断酒例会場をすぐ探せるマップ\n';

function copyShareUrl() {
  navigator.clipboard.writeText(SITE_TEXT + SITE_URL).then(() => {
    const btn = document.getElementById('share-copy');
    btn.textContent = '✅コピー完了';
    setTimeout(() => btn.textContent = '📋リンクコピー', 1500);
  });
}

function openShareBar() {
  const t = encodeURIComponent(SITE_TEXT + SITE_URL);
  const u = encodeURIComponent(SITE_URL);
  const sx = document.getElementById('share-x');
  const sl = document.getElementById('share-line');
  const sf = document.getElementById('share-fb');
  if (sx) sx.onclick = () => window.open(`https://twitter.com/intent/tweet?text=${t}`, '_blank');
  if (sl) sl.onclick = () => window.open(`https://line.me/R/share?text=${encodeURIComponent(SITE_TEXT + SITE_URL)}`, '_blank');
  if (sf) sf.onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank');
}

openShareBar();

// ===== 免責同意（1日1回） =====
function showDisclaimerIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  const agreed = localStorage.getItem('disclaimer_agreed');
  if (agreed === today) return;
  const overlay = document.getElementById('disclaimer-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function agreeDisclaimer() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem('disclaimer_agreed', today);
  const overlay = document.getElementById('disclaimer-overlay');
  if (overlay) overlay.style.display = 'none';
}

let _newsRendered = false;
function renderNews() {
  if (_newsRendered) return;
  _newsRendered = true;
  const container = document.getElementById('news');
  console.log('renderNews called', container);
  if (!container) return;
  container.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">読み込み中...</div>';
  fetch('news.json?v=' + Date.now())
    .then(r => r.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">お知らせはありません</div>';
        return;
      }
      const updated = data.generated_at ? data.generated_at.slice(0,10) : '';
      let html = `<div style="font-size:11px;color:#a0a0b0;text-align:right;margin-bottom:8px;">更新: ${updated}</div>`;
      let lastPref = '';
      for (const item of data.items) {
        if (item.pref !== lastPref) {
          html += `<div style="font-size:11px;font-weight:600;color:#888;letter-spacing:.08em;margin:12px 0 4px;">${item.pref}</div>`;
          lastPref = item.pref;
        }
        const dateStr = item.date || '';
        html += `<a href="${item.url}" target="_blank" rel="noopener" style="display:block;background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:6px;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:11px;color:#a0a0b0;margin-bottom:3px;">${dateStr} ${item.org}</div>
          <div style="font-size:13px;color:#1a1a2e;font-weight:500;line-height:1.4;">${item.title}</div>
          <div style="font-size:11px;color:#C0392B;margin-top:4px;">公式サイトで確認 →</div>
        </a>`;
      }
      container.innerHTML = html;
    })
    .catch(() => {
      container.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">読み込みエラー</div>';
    });
}
