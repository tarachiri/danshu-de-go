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

L.control.zoom({position: 'bottomleft'}).addTo(map);
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
  const areaColor = AREA_COLORS[v.prefecture] || '#555';
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
  const label = getDateLabel(v.next_date);
  const badgeColors = {
    today: '#C0392B', tomorrow: '#D35400',
    dayafter: '#9A7D0A', other: '#555', none: '#888'
  };
  const badgeTexts = {
    today: '今日開催！', tomorrow: '明日開催', dayafter: '明後日開催',
    other: '開催予定あり', none: '日程未定'
  };
  const typeEmoji = {
    'シングル': '💍', 'アメシスト': '💜', '家族': '👨‍👩‍👧', '相談': '💬', '本部': '🏛️'
  };

  const name = v.meeting_name || v.facility_name || '例会場';
  const facility = v.facility_name || '';
  const building = v.building_name || '';
  let addr = v.address || '';
  addr = addr.replace(/^.*〒\d{3}-\d{4}\s*/, '').replace(/,?\s*日本.*$/, '').trim();

  const timeStr = v.start_time ? `${v.start_time}〜${v.end_time || ''}` : '';
  const dateStr = formatDate(v.next_date);
  const emoji = typeEmoji[v.meeting_type] || '🍶';

  // Googleカレンダーリンク
  const calLink = v.htmlLink
    ? `<a href="${v.htmlLink}" target="_blank" class="popup-link cal-link">📅 Googleカレンダーで見る</a>`
    : '';

  // Google Maps経路リンク
  const mapsQuery = encodeURIComponent(addr || facility);
  const mapsLink = mapsQuery
    ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}" target="_blank" class="popup-link map-link" style="color:#000">🗺️経路を<br>調べる</a>`
    : '';

  // --- 要確認ポップアップ（needs_verification = 1）---
  // 電話表示ルール: ユーザー向け問い合わせ先は contact_phone のみ。
  // phone（会場電話）は地図リンク生成等の内部用途専用。ポップアップには出さない。
  let verifyNotice = '';
  if (Number(v.needs_verification) === 1) {
    const url = v.official_url || '';
    const isAozora = (v.meeting_name === 'あおぞら例会') || (name === 'あおぞら例会');
    const msg = isAozora
      ? 'この例会は季節や天候により開催地が変わる場合があります。'
      : 'この例会の日程は変更になる場合があります。';
    const urlLine = url
      ? `<a href="${url}" target="_blank" rel="noopener" class="verify-link">${url}</a>`
      : '';
    verifyNotice = `<div class="popup-verify">⚠️ ${msg}<br>公式サイトでご確認ください。${urlLine ? '<br>' + urlLine : ''}</div>`;
  }

  return `
    <div class="popup-box">
      <span class="popup-badge" style="background:${badgeColors[label]}">${badgeTexts[label]}</span>
      <div class="popup-name">${emoji} ${name}</div>
      ${facility && facility !== name ? `<div class="popup-facility">🏢 ${facility}${building ? ' ' + building : ''}</div>` : ''}
      ${addr ? `<div class="popup-address">📍 ${addr}</div>` : ''}
      ${dateStr ? `<div class="popup-date" style="color:${badgeColors[label]}">📅 ${dateStr} ${timeStr}</div>` : ''}
      ${v.recurrence ? `<div class="popup-recurrence">🔁 ${v.recurrence}</div>` : ''}

      
      ${v.contact_phone && false ? `<div class="popup-phone">📞 ${v.contact_phone}</div>` : ''}

      <div class="popup-links">
                ${v.official_url ? `<a href="${v.official_url}" target="_blank" class="popup-link" style="background:#27AE60;color:#fff">🌐公式<br>サイト</a>` : ''}
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
  updateModeButton();
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
  const tabMap = document.getElementById('tab-map');
  const tabSch = document.getElementById('tab-schedule');
  if (tab === 'map') {
    mapEl.style.display = '';
    schEl.style.display = 'none';
    tabMap.classList.add('active');
    tabSch.classList.remove('active');
    if (window._leafletMap) window._leafletMap.invalidateSize();
  } else {
    mapEl.style.display = 'none';
    schEl.style.display = 'block';
    tabMap.classList.remove('active');
    tabSch.classList.add('active');
    renderSchedule();
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
    const label = date.replace(/^\d{4}-/, '').replace('-', '/') + '（' + ['日','月','火','水','木','金','土'][new Date(date).getDay()] + '）';
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
let currentMode = 'comfort';

function initVenues() {
  document.getElementById('count-total').textContent = '読込中...';
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
    })
    .catch(() => {
      document.getElementById('count-total').textContent = '読込エラー';
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

function toggleMode() {
  currentMode = currentMode === 'comfort' ? 'explore' : 'comfort';
  updateModeButton();
  applyFilters();
}

function applyFilters() {
  const dateFilter = document.getElementById('date-filter').value;
  const areaFilter = document.getElementById('area-filter').value;

  clusterGroup.clearLayers();
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

    clusterGroup.addLayer(marker);
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
  document.getElementById('count-total').textContent = 
`全${VENUES.length}件中${count}件`;
}

initVenues();


// ===== モード切替ボタン（index.htmlインラインから移設・ラベル一元管理） =====
function updateModeButton() {
  const btn = document.getElementById('mode-toggle-float');
  if (!btn) return;
  if (currentMode === 'explore') {
    btn.innerHTML = '🗺️ 快適モード';
    btn.style.background = '#27AE60';
  } else {
    btn.innerHTML = '<b>探索モード</b>';
    btn.style.background = '#C0392B';
  }
}

(function initModeButton() {
  const btn = document.createElement('button');
  btn.id = 'mode-toggle-float';
  btn.style.cssText = `
    position:fixed;
    bottom:24px;
    right:16px;
    color:#fff;
    border:none;
    border-radius:24px;
    padding:10px 18px;
    font-size: 17px;
    font-weight:bold;
    cursor:pointer;
    z-index:9999;
    box-shadow:0 4px 16px rgba(0,0,0,0.5);
  `;
  btn.onclick = toggleMode;
  document.body.appendChild(btn);
  updateModeButton();
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
  document.getElementById('share-x').onclick = () => window.open(`https://twitter.com/intent/tweet?text=${t}`, '_blank');
  document.getElementById('share-line').onclick = () => window.open(`https://line.me/R/share?text=${encodeURIComponent(SITE_TEXT + SITE_URL)}`, '_blank');
  document.getElementById('share-fb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank');
}

openShareBar();
