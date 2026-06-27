const map = window._leafletMap = L.map("map", {zoomControl: false}).setView([35.68, 139.60], 9);
map.locate({setView: true, maxZoom: 10});

// GPS取得成功時 → 都道府県をGSI APIで逆ジオコーディング → エリア自動選択
map.on('locationfound', function(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`)
    .then(r => r.json())
    .then(data => {
      const muniCd = data.results && data.results.muniCd;
      if (!muniCd) return;
      const prefCode = muniCd.substring(0, 2);
      const PREF_CODE_MAP = {
        '01':'北海道','02':'青森県','03':'岩手県','04':'宮城県','05':'秋田県',
        '06':'山形県','07':'福島県','08':'茨城県','09':'栃木県','10':'群馬県',
        '11':'埼玉県','12':'千葉県','13':'東京都','14':'神奈川県','15':'新潟県',
        '16':'富山県','17':'石川県','18':'福井県','19':'山梨県','20':'長野県',
        '21':'岐阜県','22':'静岡県','23':'愛知県','24':'三重県','25':'滋賀県',
        '26':'京都府','27':'大阪府','28':'兵庫県','29':'奈良県','30':'和歌山県',
        '31':'鳥取県','32':'島根県','33':'岡山県','34':'広島県','35':'山口県',
        '36':'徳島県','37':'香川県','38':'愛媛県','39':'高知県','40':'福岡県',
        '41':'佐賀県','42':'長崎県','43':'熊本県','44':'大分県','45':'宮崎県',
        '46':'鹿児島県','47':'沖縄県'
      };
      const pref = PREF_CODE_MAP[prefCode];
      if (!pref) return;
      const area = AREA_MAP[pref] || 'all';
      _schAreaFilter = area;
      const sel = document.getElementById('sch-area-filter');
      if (sel) sel.value = area;
      _schRendered = false;
      if (document.getElementById('schedule').style.display !== 'none') {
        renderSchedule();
      }
    })
    .catch(() => {});
});

// 現在地ボタン
var LocateControl = L.Control.extend({
  onAdd: function() {
    var b = L.DomUtil.create("button","locate-btn");
    b.innerHTML = "📍";
    b.title = "現在地へ";
    L.DomEvent.on(b,"click",function(e){
      L.DomEvent.stopPropagation(e);
      map.locate({setView:true,maxZoom:12});
    });
    return b;
  }
});
new LocateControl({position:"topright"}).addTo(map);

window.setSplashProgress && window.setSplashProgress(10, '地図を初期化中...');
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

  // ── 公式サイトリンク（会場単位） ─────────────────
  const officialLink = v.official_url
    ? `<a href="${v.official_url}" target="_blank" rel="noopener" class="popup-link" style="background:#8E44AD;color:#fff">🌐 公式<br>サイト</a>`
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
        ${officialLink}
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
  // ボトムナビのactive更新
  document.querySelectorAll('.bottom-btn').forEach(b => b.classList.remove('active'));
  const bottomBtnMap = { 'map': 'tab-map', 'schedule': 'tab-schedule', 'news': 'tab-news' };
  if (bottomBtnMap[tab]) {
    const btn = document.getElementById(bottomBtnMap[tab]);
    if (btn) btn.classList.add('active');
  }
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
    loadNewsTab();
  }
}

const SCH_TODAY = getTodayJST();

// エリア定義
const AREA_MAP = {
  '北海道': '北海道',
  '青森県': '東北', '岩手県': '東北', '宮城県': '東北',
  '秋田県': '東北', '山形県': '東北', '福島県': '東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東',
  '埼玉県': '関東', '千葉県': '関東', '東京都': '関東',
  '神奈川県': '関東', '山梨県': '関東',
  '新潟県': '北陸・甲信越', '富山県': '北陸・甲信越',
  '石川県': '北陸・甲信越', '福井県': '北陸・甲信越',
  '長野県': '北陸・甲信越',
  '静岡県': '東海', '愛知県': '東海', '岐阜県': '東海',
  '三重県': '東海',
  '滋賀県': '近畿', '京都府': '近畿', '大阪府': '近畿',
  '兵庫県': '近畿', '奈良県': '近畿', '和歌山県': '近畿',
  '鳥取県': '中国', '島根県': '中国', '岡山県': '中国',
  '広島県': '中国', '山口県': '中国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国',
  '高知県': '四国',
  '福岡県': '九州・沖縄', '佐賀県': '九州・沖縄',
  '長崎県': '九州・沖縄', '熊本県': '九州・沖縄',
  '大分県': '九州・沖縄', '宮崎県': '九州・沖縄',
  '鹿児島県': '九州・沖縄', '沖縄県': '九州・沖縄',
};

const AREA_LIST = [
  '北海道', '東北', '関東', '北陸・甲信越',
  '東海', '近畿', '中国', '四国', '九州・沖縄'
];

// 現在選択中のエリア（'all'=全国）
let _schAreaFilter = 'all';

// 都道府県バッジ色（背景色, 文字色）
const PREF_BADGE_COLORS = {
  '北海道':['#1a3a5c','#5ab4ff'], '青森県':['#1a3a4c','#5ac4ff'], '岩手県':['#1a4a3c','#5ad4af'],
  '宮城県':['#1a3a2c','#5ad4bf'], '秋田県':['#2a3a1c','#8ad46f'], '山形県':['#3a3a1c','#c4d45f'],
  '福島県':['#3a2a1c','#d4a45f'], '茨城県':['#2a1a3c','#a07fe0'], '栃木県':['#3a1a2a','#e07fa0'],
  '群馬県':['#3a2a00','#ffc844'], '埼玉県':['#3a2a00','#ffc844'], '千葉県':['#3a1a2a','#ff88bb'],
  '東京都':['#1a3a5c','#5ab4ff'], '神奈川県':['#0a3a1a','#44cc88'], '新潟県':['#2a3a2a','#88cc88'],
  '富山県':['#1a3a3a','#44cccc'], '石川県':['#2a2a3a','#8888ff'], '福井県':['#3a1a3a','#cc44cc'],
  '山梨県':['#3a3a1a','#cccc44'], '長野県':['#1a4a2a','#44cc88'], '岐阜県':['#2a3a1a','#88cc44'],
  '静岡県':['#3a1a1a','#cc6644'], '愛知県':['#1a2a3a','#4488cc'], '三重県':['#2a1a3a','#8844cc'],
  '滋賀県':['#1a3a2a','#44cc88'], '京都府':['#3a1a1a','#cc4444'], '大阪府':['#3a2a1a','#cc8844'],
  '兵庫県':['#1a2a2a','#44aaaa'], '奈良県':['#3a3a1a','#aaaa44'], '和歌山県':['#3a1a2a','#cc4488'],
  '鳥取県':['#1a3a3a','#44cccc'], '島根県':['#2a3a2a','#66cc66'], '岡山県':['#3a2a2a','#cc8866'],
  '広島県':['#2a1a2a','#aa44aa'], '山口県':['#1a2a3a','#4488aa'], '徳島県':['#3a1a1a','#dd5533'],
  '香川県':['#2a3a1a','#88cc44'], '愛媛県':['#3a2a1a','#ccaa44'], '高知県':['#1a3a1a','#44cc44'],
  '福岡県':['#1a1a3a','#4444cc'], '佐賀県':['#2a1a3a','#8844bb'], '長崎県':['#3a1a2a','#cc5588'],
  '熊本県':['#3a2a1a','#cc9944'], '大分県':['#1a3a2a','#44cc99'], '宮崎県':['#2a3a1a','#88cc55'],
  '鹿児島県':['#3a1a1a','#cc5544'], '沖縄県':['#1a3a3a','#44cccc'],
};

function getPrefBadgeStyle(pref) {
  const c = PREF_BADGE_COLORS[pref] || ['#2a2a2a','#aaaaaa'];
  return `background:${c[0]};color:${c[1]};`;
}

function getPrefBadgeLabel(pref) {
  return pref.replace(/[都道府県]$/, '');
}

let _schRendered = false;
function renderSchedule() {
  if (_schRendered) return;
  _schRendered = true;
  const container = document.getElementById('schedule');

  // エリアフィルターUI
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1a1a2e;position:sticky;top:0;z-index:10;border-bottom:1px solid #0f3460;';

  const label = document.createElement('span');
  label.textContent = '📍';
  label.style.fontSize = '18px';

  const sel = document.createElement('select');
  sel.id = 'sch-area-filter';
  sel.style.cssText = 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid #0f3460;background:#0f3460;color:#fff;font-size:15px;';

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = '🗾 全国';
  sel.appendChild(optAll);

  AREA_LIST.forEach(area => {
    const opt = document.createElement('option');
    opt.value = area;
    opt.textContent = area;
    sel.appendChild(opt);
  });

  sel.value = _schAreaFilter;
  sel.addEventListener('change', () => {
    _schAreaFilter = sel.value;
    _schRendered = false;
    renderSchedule();
  });

  filterBar.appendChild(label);
  filterBar.appendChild(sel);
  container.innerHTML = '';
  container.appendChild(filterBar);

  const listEl = document.createElement('div');
  listEl.style.cssText = 'padding:0 0 80px 0;';
  container.appendChild(listEl);

  listEl.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">読み込み中...</div>';

  fetch('schedule.json?v=' + Date.now())
    .then(r => r.json())
    .then(data => {
      const filtered = _schAreaFilter === 'all'
        ? data
        : data.filter(e => AREA_MAP[e.prefecture] === _schAreaFilter);

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">この地域の例会情報はありません</div>';
        return;
      }

      const byDate = {};
      filtered.forEach(e => {
        const d = e.next_date;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(e);
      });

      let html = '';
      Object.keys(byDate).sort().forEach(date => {
        const evs = byDate[date];
        const isToday = date === SCH_TODAY;
        const dateLabel = date.replace(/^\d{4}-/, '').replace('-', '/') + '（' + ['日','月','火','水','木','金','土'][new Date(date + 'T00:00:00+09:00').getDay()] + '）';
        html += `<div class="sch-date-header"><span>${dateLabel}</span>${isToday ? '<span class="sch-date-today">今日</span>' : ''}<span class="sch-date-count">${evs.length}件</span></div>`;
        evs.forEach(e => {
          const clickAttr = (e.latitude && e.longitude)
            ? ` onclick="jumpToMarker(${e.id}, ${e.latitude}, ${e.longitude}, '${(e.meeting_name || '').replace(/['"]/g, '')}')" style="cursor:pointer;"`
            : '';
          html += `<div class="sch-card"${clickAttr}><div class="sch-time"><div class="sch-time-start">${e.start_time || ''}</div><div class="sch-time-end" style="font-size:14px;color:#888;">${e.end_time || ''}</div></div><div class="sch-info"><div class="sch-name">${e.meeting_name}</div><div class="sch-loc">📍 ${e.address || ''}</div></div><span class="sch-pref-badge" style="${getPrefBadgeStyle(e.prefecture)}">${getPrefBadgeLabel(e.prefecture)}</span></div>`;
        });
      });
      listEl.innerHTML = html;
    })
    .catch(() => {
      listEl.innerHTML = '<div style="color:#e94560;text-align:center;padding:32px;">取得エラー</div>';
    });
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
  window.setSplashProgress && window.setSplashProgress(30, '例会情報を取得中...');
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
      window.setSplashProgress && window.setSplashProgress(80, 'データを解析中...');
      applyFilters();
      window.setSplashProgress && window.setSplashProgress(100, '準備完了！');
    })
    .catch((err) => {
      console.error('venues.json fetch失敗:', err);
      window.setSplashProgress && window.setSplashProgress(100, '⚠️ 読み込み失敗');
      const el = document.getElementById('splash-overlay');
      if (el) el.onclick = () => location.reload();
      const totalEl2 = document.getElementById('count-total-header');
      if (totalEl2) totalEl2.textContent = '!';
    });
}

function showInstallGuide() {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isChrome = /chrome/.test(ua) && !/edg/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
  const isFirefox = /firefox/.test(ua);
  const isEdge = /edg/.test(ua);
  const isLine = /line/.test(ua);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1a1a2e;color:#fff;padding:24px;width:100%;border-top:3px solid #C0392B;border-radius:16px 16px 0 0;max-height:80vh;overflow-y:auto;';

  const closeBtn = `<button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:16px;width:100%;padding:12px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:bold;">閉じる</button>`;

  let content = '';

  if (isLine) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:16px;line-height:2;color:#ccc;">
        LINEブラウザではホーム画面への追加ができません。<br>
        右上の <b style="color:#fff;">「…」→「ブラウザで開く」</b> をタップしてから追加してください。
      </div>
    `;
  } else if (isIOS && isSafari) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        ① 下のメニューバーの <b style="color:#fff;">「共有」</b> をタップ<br>
        ② <b style="color:#fff;">「ホーム画面に追加」</b> を選択<br>
        ③ 右上の <b style="color:#fff;">「追加」</b> をタップ
      </div>
    `;
  } else if (isIOS && isChrome) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        ① 右下の <b style="color:#fff;">「…」</b> をタップ<br>
        ② <b style="color:#fff;">「ホーム画面に追加」</b> を選択
      </div>
      <div style="font-size:13px;color:#888;margin-top:8px;">
        ※ iOS版Chromeは機能が制限される場合があります。Safariでの追加を推奨します。
      </div>
    `;
  } else if (isAndroid && isChrome) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        ① ブラウザ右上の <b style="color:#fff;">「⋮」</b> をタップ<br>
        ② <b style="color:#fff;">「ホーム画面に追加」</b> を選択
      </div>
      <div style="font-size:13px;color:#888;margin-top:8px;">
        ※ アドレスバーに「インストール」アイコンが表示される場合はそちらからも追加できます。
      </div>
    `;
  } else if (isAndroid && isFirefox) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        ① ブラウザ右上の <b style="color:#fff;">「⋮」</b> をタップ<br>
        ② <b style="color:#fff;">「ページのショートカット」</b> を選択<br>
        ③ <b style="color:#fff;">「ホーム画面に追加」</b> をタップ
      </div>
    `;
  } else if (isEdge) {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        ① ブラウザ右下の <b style="color:#fff;">「…」</b> をタップ<br>
        ② <b style="color:#fff;">「電話に追加」</b> を選択
      </div>
    `;
  } else {
    content = `
      <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:12px;">📲 ホーム画面に追加しよう！</div>
      <div style="font-size:18px;line-height:2;color:#ccc;">
        お使いのブラウザのメニューから<br>
        <b style="color:#fff;">「ホーム画面に追加」</b> または<br>
        <b style="color:#fff;">「アプリをインストール」</b> を選択してください。
      </div>
    `;
  }

  modal.innerHTML = content + closeBtn;
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
  const dateFilter = document.getElementById('date-filter')?.value || 'all';
  const areaFilter = document.getElementById('area-filter')?.value || 'all';

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
      .bindPopup(buildPopup(v), { maxWidth: 300, autoPan: false });

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
  const todayHeaderEl = document.getElementById('count-today-header');
  if (todayHeaderEl) todayHeaderEl.textContent = todayCount;
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
    bottom: 160px;
    right: 16px;
    z-index: 500;
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

function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

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
    ...(!isPWA() ? [{ icon: '📲', label: 'ホーム画面に追加', action: () => { closeMenu(); showInstallGuide(); } }] : []),
    { icon: '🗺️', label: '快適モード', action: () => { closeMenu(); setMode('comfort'); } },
    { icon: '🔍', label: '探索モード', action: () => { closeMenu(); setMode('explore'); } },
    { icon: '📖', label: 'マニュアル', action: () => { closeMenu(); window.open('docs/manual.html', '_blank'); } },
    { icon: '❓', label: 'FAQ', action: () => { closeMenu(); window.open('docs/faq.html', '_blank'); } },
    { icon: '🤖', label: 'かもちゃんに相談', action: () => { closeMenu(); window.open('chat.html', '_blank'); } },
  ];

  // SNSシェアバー（最上部）
  const shareBar = document.createElement('div');
  shareBar.style.cssText = `
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #0f3460;
  `;

  const shareButtons = [
    {
      label: '𝕏',
      title: 'Xでシェア',
      color: '#000000',
      action: () => {
        const t = encodeURIComponent(SITE_TEXT + SITE_URL);
        window.open(`https://twitter.com/intent/tweet?text=${t}`, '_blank');
        closeMenu();
      }
    },
    {
      label: 'f',
      title: 'Facebookでシェア',
      color: '#1877F2',
      action: () => {
        const u = encodeURIComponent(SITE_URL);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank');
        closeMenu();
      }
    },
    {
      label: 'LINE',
      title: 'LINEでシェア',
      color: '#06C755',
      action: () => {
        window.open(`https://line.me/R/share?text=${encodeURIComponent(SITE_TEXT + SITE_URL)}`, '_blank');
        closeMenu();
      }
    },
    {
      id: 'menu-share-copy',
      label: '🔗',
      title: 'リンクをコピー',
      color: '#7F8C8D',
      action: () => {
        navigator.clipboard.writeText(SITE_TEXT + SITE_URL).then(() => {
          const btn = document.getElementById('menu-share-copy');
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = '✅';
            btn.style.background = '#27AE60';
            setTimeout(() => {
              btn.textContent = orig;
              btn.style.background = '#7F8C8D';
            }, 2000);
          }
        });
      }
    },
  ];

  shareButtons.forEach(sb => {
    const btn = document.createElement('button');
    if (sb.id) btn.id = sb.id;
    btn.textContent = sb.label;
    btn.title = sb.title;
    btn.style.cssText = `
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: ${sb.color};
      color: #fff;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    btn.addEventListener('click', sb.action);
    shareBar.appendChild(btn);
  });

  panel.appendChild(shareBar);

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



// かもちゃんパネル
function openKamo() {
  let panel = document.getElementById('kamo-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'kamo-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:60px;z-index:999;background:#fff;display:flex;flex-direction:column;';
    panel.innerHTML = '<iframe src="chat.html" style="flex:1;border:none;width:100%;height:100%;"></iframe>';
    document.body.appendChild(panel);
  } else {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }
  // ボトムナビのactive更新
  document.querySelectorAll('.bottom-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('bottom-kamo').classList.add('active');
}
// ============================================================
// お知らせタブ (news.json) 表示機能
// app.js の末尾に追記する
// ============================================================

// ─── お知らせタブ 読み込み ───────────────────────────────
let _newsEventsData = null; // ソートトグル用キャッシュ

function toggleNewsSort() {
  alert('タップされました');
  const sortBtn = document.getElementById('news-sort-btn');
  const list = document.getElementById('news-events-list');
  if (!sortBtn || !list) return;
  const isDateOrder = sortBtn.dataset.sort === 'date';
  if (isDateOrder) {
    sortBtn.dataset.sort = '';
    sortBtn.querySelector('.sort-icon').textContent = '↓';
    sortBtn.querySelector('.sort-label').textContent = '新着順';
    list.innerHTML = _newsEventsData.map(buildEventCard).join('');
  } else {
    sortBtn.dataset.sort = 'date';
    sortBtn.querySelector('.sort-icon').textContent = '↑';
    sortBtn.querySelector('.sort-label').textContent = '開催日順';
    const sorted = [..._newsEventsData].sort((a, b) => {
      const da = a.date_from || a.date || '';
      const db = b.date_from || b.date || '';
      return da.localeCompare(db);
    });
    list.innerHTML = sorted.map(buildEventCard).join('');
  }
}

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
    _newsEventsData = data.events || [];
    if (_newsEventsData.length > 0) {
      html += `<div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid #ddd; padding-right:12px;">
  <h2 class="news-section-title" style="border-top:none; flex:1;">📅 イベント・行事</h2>
  <button id="news-sort-btn" type="button" onclick="toggleNewsSort()" style="display:flex; align-items:center; gap:5px; font-size:12px; color:#555; background:#fff; border:1px solid #ccc; border-radius:20px; padding:5px 12px; cursor:pointer; white-space:nowrap; flex-shrink:0; touch-action:manipulation;">
    <span class="sort-icon">↓</span>
    <span class="sort-label">新着順</span>
  </button>
</div>`;
      html += '<div id="news-events-list">';
      for (const ev of _newsEventsData) {
        html += buildEventCard(ev);
      }
      html += '</div>';
    }

    // ── PDF資料セクション ────────────────────────────────
    const pdfs = (data.pdfs || []);
    if (pdfs.length > 0) {
      html += '<h2 class="news-section-title">📄 PDF資料・お知らせ</h2>';
      for (const pdf of pdfs) {
        html += buildPdfCard(pdf);
      }
    }

    // ── 最新ニュース（RSS）セクション ────────────────────
    const news = (data.news || []);
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

// ─── イベントカード ──────────────────────────────────────
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

// ─── PDFカード ───────────────────────────────────────────
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

// ─── ニュース（RSS）カード ──────────────────────────────
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

// ─── ユーティリティ ──────────────────────────────────────
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

// ─── switchTab 連携 ──────────────────────────────────────
// 既存の switchTab 関数内の case 'news': に以下を追加してください:
//
//   case 'news':
//     loadNewsTab();   // ← この1行を追加
//     break;
