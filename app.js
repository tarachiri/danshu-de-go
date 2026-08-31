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
      Schedule.setFilter(pref);
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
  attribution: false
}).addTo(map);
// 地図内蔵の著作権表示は地図の可視領域を圧迫するため無効化し、
// 画面下部フッター内に静的な帰属表示として設置する（下記footer参照）

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
  const today = PinSchedule.jstNow().date;
  const [year, month, day] = today.split('-').map(Number);
  const dateAfter = days => new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  const tomorrow = dateAfter(1);
  const dayAfter = dateAfter(2);
  if (next_date === today)     return 'today';
  if (next_date === tomorrow)  return 'tomorrow';
  if (next_date === dayAfter)  return 'dayafter';
  return 'other';
}

// ピンスタイル
function getStyle(v) {
  const label = getDateLabel(v.next_date);
  if (label === 'today' && PinSchedule.isDayMeeting(v.start_time)) {
    return { color: '#2471A3', size: 28, cls: 'pin-today' };
  }
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
    today:       '#C0392B',
    tomorrow:    '#D35400',
    dayafter:    '#9A7D0A',
    other:       '#555',
    none:        '#888',
    cancel:      '#7D3C00',      // 中止
    reschedule:  '#E67E22',      // 日程変更
    date_change: '#E67E22',      // 日程変更
    venue_change: '#3498DB',     // 会場変更
    exception:   '#F39C12'       // その他要確認
  };
  const badgeTexts = {
    today:       '今日開催！',
    tomorrow:    '明日開催',
    dayafter:    '明後日開催',
    other:       '開催予定あり',
    none:        '日程未定',
    cancel:      '🚫 中止',
    reschedule:  '📍 日程変更',
    date_change: '📍 日程変更',
    venue_change: '📌 会場変更',
    exception:   '⚠️ 要確認'
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
    // 大見出しバッジ：has_exception か next_date で判定（4分類）
    if (first.has_exception) {
      if (first.exc_type === 'cancel') {
        headLabel = 'cancel';
      } else if ((first.exc_note || '').includes('会場変更') || (first.exc_note || '').includes('会場')) {
        headLabel = 'venue_change';
      } else if (first.exc_type === 'reschedule' || first.exc_type === 'date_change') {
        headLabel = first.exc_type;
      } else {
        headLabel = 'exception';
      }
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
      // カードごとバッジ（4分類：中止 / 日程変更 / 会場変更 / その他要確認）
      let cardLabel;
      if (m.has_exception) {
        if (m.exc_type === 'cancel') {
          cardLabel = 'cancel';
        } else if ((m.exc_note || '').includes('会場変更') || (m.exc_note || '').includes('会場')) {
          cardLabel = 'venue_change';
        } else if (m.exc_type === 'reschedule' || m.exc_type === 'date_change') {
          cardLabel = m.exc_type;
        } else {
          cardLabel = 'exception';
        }
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


// ============================================================
// ボトムシート用コンテンツ生成
// buildPopup()と同じデータ源・同じ日付ラベル/バッジロジックを使うが、
// 1件に圧縮せず、meeting_idごとに直近開催予定を最大2件まで展開する
// ============================================================
function getUpcomingDates(m) {
  const dates = [];
  if (m.next_date) dates.push(m.next_date);
  // 【申し送り】次々回日付(next_date_2)はvenues.json生成側(tyo generate_map_v6.py)で
  // recurrenceから計算して追加する改修が必要。未実装の間は1件のみ表示される。
  if (m.next_date_2) dates.push(m.next_date_2);
  return dates.slice(0, 2); // 無限生成防止：必ず2件で打ち切る
}

function buildSheetMeetingGroup(m) {
  const typeEmoji = {
    'シングル':   '🔵',
    'アメシスト': '💜',
    '家族':       '👨‍👩‍👧',
    '相談':       '💬',
    '本部':       '🏛️'
  };
  const badgeColors = {
    today: '#C0392B', tomorrow: '#D35400', dayafter: '#9A7D0A',
    other: '#555', none: '#888',
    cancel: '#7D3C00', reschedule: '#E67E22', date_change: '#E67E22',
    venue_change: '#3498DB', exception: '#F39C12'
  };
  const badgeTexts = {
    today: '今日開催！', tomorrow: '明日開催', dayafter: '明後日開催',
    other: '開催予定あり', none: '日程未定',
    cancel: '🚫 中止', reschedule: '📍 日程変更', date_change: '📍 日程変更',
    venue_change: '📌 会場変更', exception: '⚠️ 要確認'
  };

  const mEmoji = typeEmoji[m.meeting_type] || '';
  const dates = getUpcomingDates(m);

  let itemsHTML;
  if (m.has_exception) {
    // 4分類：中止 / 日程変更 / 会場変更 / その他要確認
    let cardLabel;
    if (m.exc_type === 'cancel') {
      cardLabel = 'cancel';
    } else if ((m.exc_note || '').includes('会場変更') || (m.exc_note || '').includes('会場')) {
      cardLabel = 'venue_change';
    } else if (m.exc_type === 'reschedule' || m.exc_type === 'date_change') {
      cardLabel = m.exc_type;
    } else {
      cardLabel = 'exception';
    }
    itemsHTML = `
      <div class="sheet-upcoming-item">
        <span class="sheet-date-badge" style="background:${badgeColors[cardLabel]}">${badgeTexts[cardLabel]}</span>
        ${m.exc_note ? `<span class="sheet-exception-note">📢 ${m.exc_note}</span>` : ''}
      </div>`;
  } else if (dates.length === 0) {
    itemsHTML = `
      <div class="sheet-upcoming-item">
        <span class="sheet-date-badge" style="background:${badgeColors.none}">${badgeTexts.none}</span>
      </div>`;
  } else {
    itemsHTML = dates.map(d => {
      const label = getDateLabel(d);
      const timeStr = m.start_time ? `${m.start_time}〜${m.end_time || ''}` : '';
      return `
      <div class="sheet-upcoming-item">
        <span class="sheet-date-badge" style="background:${badgeColors[label]}">${badgeTexts[label]}</span>
        <span>${formatDate(d)}</span>
        ${timeStr ? `<span class="sheet-upcoming-time">${timeStr}</span>` : ''}
      </div>`;
    }).join('');
  }

  const favBtn = favoriteBtnHTML(m);

  return `
    <div class="sheet-meeting-group">
      <div class="sheet-meeting-name">${mEmoji ? mEmoji + ' ' : ''}${m.name}${favBtn}</div>
      ${m.recurrence ? `<div class="sheet-meeting-recurrence">🔁 ${m.recurrence}${m.start_time ? '　' + m.start_time + '〜' + (m.end_time||'') : ''}</div>` : ''}
      <div class="sheet-upcoming-list">${itemsHTML}</div>
    </div>`;
}

function buildSheetContent(v) {
  let addr = v.address || '';
  addr = addr.replace(/^.*〒\d{3}-\d{4}\s*/, '').replace(/,?\s*日本.*$/, '').trim();

  const meetings = (v.meetings && v.meetings.length > 0) ? v.meetings : null;

  let verifyBanner = '';
  if (Number(v.needs_verification) === 1) {
    const url = v.official_url || '';
    const isAozora = (v.facility_name === 'あおぞら例会' || (meetings && meetings[0] && meetings[0].name === 'あおぞら例会'));
    const msg = isAozora
      ? 'この例会は季節や天候により開催地が変わる場合があります。'
      : 'この例会の日程は変更になる場合があります。';
    verifyBanner = `
      <div class="sheet-verify-banner">
        ⚠️ ${msg}
        ${url ? `<a href="${url}" target="_blank" rel="noopener">公式サイト</a>で要確認` : '事前に確認を'}
      </div>`;
  }

  const meetingsHTML = meetings
    ? meetings.map(buildSheetMeetingGroup).join('')
    : `<div class="sheet-meeting-group">
         <div class="sheet-upcoming-item">
           <span class="sheet-date-badge" style="background:#888">📅 ${v.fallback_next_date ? formatDate(v.fallback_next_date) : '日程未定'}</span>
           ${v.fallback_schedule ? `<span class="sheet-upcoming-time">🔁 ${v.fallback_schedule}</span>` : ''}
         </div>
       </div>`;

  const calLink = v.calendar_url
    ? `<a href="${v.calendar_url}" target="_blank" class="sheet-btn-cal">📅 公式カレンダー</a>` : '';
  const officialLink = v.official_url
    ? `<a href="${v.official_url}" target="_blank" rel="noopener" class="sheet-btn-official">🌐 公式サイト</a>` : '';
  const mapsQuery = encodeURIComponent(addr || v.facility_name || '');
  const mapsLink = mapsQuery
    ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}" target="_blank" class="sheet-btn-map">🗺️ 経路を調べる</a>` : '';

  // 最寄駅・徒歩距離バッジ（データが揃っている場合のみ切り替え。それ以外は既存の固定文言）
  const venueBadgeLabel = (v.nearest_station && v.walk_duration_min != null)
    ? `🚶 ${v.nearest_station}駅 徒歩${v.walk_duration_min}分`
    : '📍 会場・例会情報';

  return `
    <div class="sheet-venue-badge">${venueBadgeLabel}</div>
    <div class="sheet-title">🏢 ${v.facility_name || '会場'}</div>
    ${addr ? `<div class="sheet-address">📍 ${addr}</div>` : ''}
    ${verifyBanner}
    <div class="sheet-section-title">開催予定の例会・イベント</div>
    ${meetingsHTML}
    <a href="https://line.me/R/oaMessage/%40867qlgsx/?${encodeURIComponent((v.facility_name||'会場')+'のページから問い合わせ')}" class="sheet-btn-line" target="_blank">🟢 LINEで問い合わせる</a>
    ${calLink}
    ${officialLink}
    ${mapsLink}
  `;
}

function openVenueSheet(v) {
  closeMenuSheet();
  const sheet = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('sheet-overlay');
  const content = document.getElementById('sheet-content');
  if (!sheet || !overlay || !content) return;
  content.innerHTML = buildSheetContent(v);
  sheet.classList.add('open');
  overlay.classList.add('active');
  document.body.classList.add('sheet-active');
  trackVenueView(v);
}

function trackVenueView(v) {
  if (!v || !v.id || !window.DanshuActivityApi) return;
  let token = USER_TOKEN;
  if (!token && window.DanshuBrowserIdentity) {
    try {
      token = window.DanshuBrowserIdentity.initialize(localStorage, window.crypto).userToken;
    } catch (error) {
      return;
    }
  }
  window.DanshuActivityApi.recordVenueView(token, v.id).then(result => {
    if (result && result.new_badges && result.new_badges.length) {
      const badge = result.new_badges[0];
      if (typeof showToast === 'function') showToast(`🏅 ${badge.title}`);
    }
  });
}

function closeVenueSheet() {
  const sheet = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet) sheet.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.classList.remove('sheet-active');
}

function openMenuSheet() {
  closeVenueSheet();
  const sheet = document.getElementById('menu-sheet');
  const overlay = document.getElementById('menu-sheet-overlay');
  if (!sheet || !overlay) return;
  sheet.classList.add('open');
  overlay.classList.add('active');
  document.body.classList.add('sheet-active');
}

function closeMenuSheet() {
  const sheet = document.getElementById('menu-sheet');
  const overlay = document.getElementById('menu-sheet-overlay');
  if (sheet) sheet.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.classList.remove('sheet-active');
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

// 座標から最寄りvenueデータを探す（findMarkerByCoordsのvenues.json版）
function findVenueByCoords(lat, lng) {
  let best = null, bestD = Infinity;
  (window.VENUES || []).forEach(v => {
    if (!v.lat || !v.lng) return;
    const d = Math.abs(v.lat - lat) + Math.abs(v.lng - lng);
    if (d < bestD) { bestD = d; best = v; }
  });
  return bestD < 0.001 ? best : null;
}

// マーカージャンプ
function jumpToMarker(id, lat, lng, name) {
  if (!lat || !lng) return;
  switchTab('map');
  currentMode = 'explore';
  const mBtn = document.getElementById('menu-toggle-float');
  if (mBtn) mBtn.style.background = '#27AE60';
  const areaFilter = document.getElementById('area-filter');
  const dateFilter = document.getElementById('date-filter');
  if (areaFilter) areaFilter.value = 'all';
  if (dateFilter) dateFilter.value = 'all';
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
            const v = (window.VENUES || []).find(x => String(x.id) === String(id)) || findVenueByCoords(lat, lng);
            if (v) openVenueSheet(v);
          });
        } else if (name) {
          // venueデータが見当たらない場合の最低限のフォールバック表示
          openVenueSheet({ facility_name: name, address: '', meetings: null });
        }
      });
    }
  }, 300);
}

// タブ切替
function switchTab(tab) {
  // #seo-summary閲覧中にタブ切替した場合、#app-shellが画面内に戻るようスクロール位置をリセット
  // （2026-07-25、bodyスクロール可能化に伴う対応）
  window.scrollTo(0, 0);
  // ボトムナビのactive更新
  document.querySelectorAll('.bottom-btn').forEach(b => b.classList.remove('active'));
  const bottomBtnMap = { 'map': 'tab-map', 'schedule': 'tab-schedule', 'news': 'tab-news', 'bulletin': 'tab-bulletin', 'kamo': 'bottom-kamo' };
  if (bottomBtnMap[tab]) {
    const btn = document.getElementById(bottomBtnMap[tab]);
    if (btn) btn.classList.add('active');
  }
  const mapEl = document.getElementById('map');
  const schEl = document.getElementById('schedule');
  const newsEl = document.getElementById('news');
  const bulletinEl = document.getElementById('bulletin');
  const kamoEl = document.getElementById('kamo');
  const footerEl = document.getElementById('footer');
  const mapAttrEl = document.getElementById('map-attribution');
  const tabMap = document.getElementById('tab-map');
  const tabSch = document.getElementById('tab-schedule');
  const tabNews = document.getElementById('tab-news');
  const tabBulletin = document.getElementById('tab-bulletin');
  const tabKamo = document.getElementById('bottom-kamo');
  mapEl.style.display = 'none';
  schEl.style.display = 'none';
  if (newsEl) newsEl.style.display = 'none';
  if (bulletinEl) bulletinEl.style.display = 'none';
  if (kamoEl) kamoEl.style.display = 'none';
  tabMap.classList.remove('active');
  tabSch.classList.remove('active');
  if (tabNews) tabNews.classList.remove('active');
  if (tabBulletin) tabBulletin.classList.remove('active');
  if (tabKamo) tabKamo.classList.remove('active');
  // フッター・地図帰属バーは「マップ画面」以外のタブでのみ表示
  if (footerEl) footerEl.style.display = (tab === 'map') ? 'none' : 'block';
  if (mapAttrEl) mapAttrEl.style.display = (tab === 'map') ? 'block' : 'none';
  // 【備考】footer/map-attributionは両方とも画面最下部(bottom:0)・ボトムナビはその直上(bottom:16px)で統一済みのため、
  // footer-hiddenクラスは現在CSS側では未使用（将来の調整用に残置）
  document.body.classList.toggle('footer-hidden', tab === 'map');
  if (tab === 'map') {
    mapEl.style.display = '';
    tabMap.classList.add('active');
    if (window._leafletMap) window._leafletMap.invalidateSize();
  } else if (tab === 'schedule') {
    schEl.style.display = 'block';
    tabSch.classList.add('active');
    Schedule.render();
  } else if (tab === 'news') {
    if (newsEl) newsEl.style.display = 'block';
    if (tabNews) tabNews.classList.add('active');
    loadNewsTab();
  } else if (tab === 'bulletin') {
    if (bulletinEl) bulletinEl.style.display = 'block';
    if (tabBulletin) tabBulletin.classList.add('active');
    if (navigator.clearAppBadge) navigator.clearAppBadge();
    loadBulletinBoard();
  } else if (tab === 'kamo') {
    openKamo();
    if (kamoEl) kamoEl.style.display = 'flex';
    if (tabKamo) tabKamo.classList.add('active');
  }
}

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



let VENUES = [];
let clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 10,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 14
});
map.addLayer(clusterGroup);

// 【廃止】旧ポップアップ方式のmaxHeight解除処理。
// ボトムシート方式（openVenueSheet）へ移行したため不要になった。
let comfortGroup = L.layerGroup();
let currentMode = 'comfort';

function initVenues() {
  const totalEl = document.getElementById('count-total-header');
  if (totalEl) totalEl.textContent = '...';
  window.setSplashProgress && window.setSplashProgress(30, '例会情報を取得中...');
  fetch('venues.json')
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
    .then(async data => {
      window.setSplashProgress && window.setSplashProgress(55, '例会情報を受信しました');
      await yieldForSplashPaint();
      VENUES = data;
      window.VENUES = VENUES;
      window.setSplashProgress && window.setSplashProgress(80, 'データを解析中...');
      await yieldForSplashPaint();
      applyFilters();
      window.setSplashProgress && window.setSplashProgress(95, '地図を仕上げています...');
      await yieldForSplashPaint();
      jumpToVenueFromUrl();
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

function yieldForSplashPaint() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function jumpToVenueFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const venueId = params.get('venue') || params.get('pin') || params.get('id');
  if (!venueId) return;

  const venue = VENUES.find(v => String(v.id) === String(venueId));
  if (!venue || !venue.lat || !venue.lng) return;

  setTimeout(() => {
    jumpToMarker(venue.id, venue.lat, venue.lng, venue.facility_name || venue.meeting_name || '');
  }, 500);
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

    const pinVenue = PinSchedule.withEffectiveOccurrence(v);
    if (!pinVenue) return;

    const label = getDateLabel(pinVenue.next_date);

    // モード判定
    if (currentMode === 'comfort' && label === 'none') return;
    if (currentMode === 'comfort' && label === 'other') return;

    // 日付フィルター
    if (dateFilter !== 'all' && label !== dateFilter) return;

    // エリアフィルター
    if (areaFilter !== 'all' && v.prefecture !== areaFilter) return;

    const marker = L.marker([v.lat, v.lng], { icon: makeIcon(pinVenue) });
    marker.on('click', () => openVenueSheet(pinVenue));

    activeGroup.addLayer(marker);
    window._markers[v.id] = marker;
    count++;
  });


let todayCount=0, todayDayCount=0, todayEveningCount=0, tomorrowCount=0, dayafterCount=0;
  VENUES.forEach(v => {
    const pinVenue = PinSchedule.withEffectiveOccurrence(v);
    if (!pinVenue) return;
    const l = getDateLabel(pinVenue.next_date);
    if(l==='today') {
      todayCount++;
      if (PinSchedule.isDayMeeting(pinVenue.start_time)) todayDayCount++;
      else todayEveningCount++;
    }
    else if(l==='tomorrow') tomorrowCount++;
    else if(l==='dayafter') dayafterCount++;
  });
  document.getElementById('count-today-day').textContent = todayDayCount;
  document.getElementById('count-today-evening').textContent = todayEveningCount;
  const todayHeaderEl = document.getElementById('count-today-header');
  if (todayHeaderEl) todayHeaderEl.textContent = todayCount;
  document.getElementById('count-tomorrow').textContent = tomorrowCount;
  document.getElementById('count-dayafter').textContent = dayafterCount;
  const totalMeetings = VENUES.reduce((sum, v) => sum + (v.meetings ? v.meetings.length : 0), 0);
  const headerEl = document.getElementById('count-total-header');
  if (headerEl) headerEl.textContent = totalMeetings;
}

initVenues();
// ページを開いたままでも、終了時刻を過ぎたら次の開催候補へ切り替える。
setInterval(applyFilters, 60 * 1000);


// ===== カスタム縦ズームスライダー =====
(function initZoomSlider() {
  const MIN_ZOOM = 5;
  const MAX_ZOOM = 18;

  const container = document.createElement('div');
  container.id = 'zoom-slider-container';
  container.style.cssText = `
    position: absolute;
    bottom: 86px;
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
  // #app-shellに追加（bodyではなく）: position:absoluteで#app-shell基準にすることで
  // #seo-summaryまでスクロールした際、地図と一緒に画面外へ流れるようにする
  // （2026-07-25、bodyスクロール可能化に伴う対応）
  document.getElementById('app-shell').appendChild(container);
})();

// ===== Service Worker登録（index.htmlインラインから移設） =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

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
  const panel = document.getElementById('kamo');
  if (!panel || panel.dataset.loaded === '1') return;
  panel.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:60px;z-index:999;background:#fff;flex-direction:column;';
  panel.innerHTML = '<iframe src="chat.html" style="flex:1;border:none;width:100%;height:100%;"></iframe>';
  panel.dataset.loaded = '1';
}

// ===== SNSシェア・リンクコピー =====
// SITE_URL・SITE_TEXT は js/menu.js で定義済み（重複宣言でSyntaxErrorになるため削除）

function setupShareLinks() {
  const t = encodeURIComponent(SITE_TEXT + SITE_URL);
  const u = encodeURIComponent(SITE_URL);
  const xEl = document.getElementById('share-x');
  const lineEl = document.getElementById('share-line');
  const fbEl = document.getElementById('share-fb');
  if (xEl) xEl.href = `https://twitter.com/intent/tweet?text=${t}`;
  if (lineEl) lineEl.href = `https://social-plugins.line.me/lineit/share?url=${u}`;
  if (fbEl) fbEl.href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
}

function copyShareUrl() {
  navigator.clipboard.writeText(SITE_TEXT + SITE_URL).then(() => {
    const btn = document.getElementById('share-copy');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✅ コピー済み';
    btn.style.color = '#27AE60';
    btn.style.borderColor = '#27AE60';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '#aaa';
      btn.style.borderColor = '#888';
    }, 2000);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupShareLinks);
} else {
  setupShareLinks();
}

// ═══════════════════════════════════════════
// 掲示板機能
// ═══════════════════════════════════════════

const API_BASE = 'https://chat.nukadokonokai.com';
let CLIENT_TOKEN = null;
let USER_TOKEN = null;

function initBulletin() {
  const identity = initBrowserIdentity();
  USER_TOKEN = identity.userToken;
  CLIENT_TOKEN = identity.bulletinToken;
  resolveBrowserIdentity();
  if (window.DanshuActivityApi) {
    window.DanshuActivityVisitReady = window.DanshuActivityApi.recordVisit(USER_TOKEN).then(result => {
      if (result && result.new_badges && result.new_badges.length && typeof showToast === 'function') {
        showToast(`🏅 ${result.new_badges[0].title}`);
      }
      return result;
    });
  }
  loadFavorites();
  attachFavoriteHandlers();
  registerServiceWorker();
  subscribePush();
  loadBulletinBoard();
}

function initBrowserIdentity() {
  if (!window.DanshuBrowserIdentity) {
    throw new Error('DanshuBrowserIdentity is not loaded');
  }
  return window.DanshuBrowserIdentity.initialize(localStorage, window.crypto);
}

function resolveBrowserIdentity() {
  if (!window.DanshuIdentityApi || !USER_TOKEN) return;
  window.DanshuIdentityApi.resolve(USER_TOKEN).then(result => {
    if (result && result.created) {
      console.log('[Identity] 新規利用者として紐付けました');
    }
  });
}

let FAVORITE_MEETINGS = null;

function favoriteBtnHTML(m) {
  if (!window.DanshuFavoriteUi || !m || !m.meeting_id) return '';
  const favorite = window.DanshuFavoriteUi.isFavorite(FAVORITE_MEETINGS, m.meeting_id);
  return window.DanshuFavoriteUi.buttonHTML(m.meeting_id, favorite);
}

function setFavoriteButton(btn, favorite) {
  const fav = Boolean(favorite);
  btn.classList.toggle('is-fav', fav);
  btn.textContent = fav ? '★' : '☆';
  btn.setAttribute('aria-pressed', String(fav));
  btn.setAttribute('aria-label', fav ? 'お気に入りから外す' : 'お気に入りに追加');
}

function refreshFavoriteButtons() {
  if (!window.DanshuFavoriteUi) return;
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const meetingId = Number(btn.dataset.meetingId);
    setFavoriteButton(btn, window.DanshuFavoriteUi.isFavorite(FAVORITE_MEETINGS, meetingId));
  });
}

function handleFavoriteToggle(btn) {
  if (!window.DanshuFavoriteApi || !window.DanshuFavoriteUi || !USER_TOKEN) return;
  const meetingId = Number(btn.dataset.meetingId);
  if (!meetingId) return;
  const wasFavorite = window.DanshuFavoriteUi.isFavorite(FAVORITE_MEETINGS, meetingId);
  const next = !wasFavorite;
  // 楽観的更新（失敗時は巻き戻す）
  setFavoriteButton(btn, next);
  FAVORITE_MEETINGS = window.DanshuFavoriteUi.toggleState(FAVORITE_MEETINGS, meetingId, next);
  const request = next
    ? window.DanshuFavoriteApi.add(USER_TOKEN, meetingId)
    : window.DanshuFavoriteApi.remove(USER_TOKEN, meetingId);
  request.then(result => {
    if (result) return;
    setFavoriteButton(btn, wasFavorite);
    FAVORITE_MEETINGS = window.DanshuFavoriteUi.toggleState(FAVORITE_MEETINGS, meetingId, wasFavorite);
  });
}

function attachFavoriteHandlers() {
  document.addEventListener('click', function onFavoriteBtnClick(event) {
    const btn = event.target && event.target.closest ? event.target.closest('.fav-btn') : null;
    if (!btn) return;
    event.preventDefault();
    handleFavoriteToggle(btn);
  });
}

function loadFavorites() {
  if (!window.DanshuFavoriteApi || !USER_TOKEN) return;
  window.DanshuFavoriteApi.list(USER_TOKEN).then(favorites => {
    if (!favorites) return;
    FAVORITE_MEETINGS = favorites;
    refreshFavoriteButtons();
  });
}

function registerServiceWorker() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('[Bulletin] SW registration failed:', err);
  });
}

async function subscribePush() {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  if (!('PushManager' in window)) {
    console.warn('[Bulletin] Push API not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('[Bulletin] Already subscribed to push');
      return;
    }

    // VAPID 公開鍵
    const vapidPublicKey = 'BHmDVH5alXSaOhlfjUmyf2l9UCtltuBebR6uFbznS67gZ1xww0g_W3EksrOm8fsDMJO5VfMZtlo7cBXHnZEBIAY';

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    await fetch(`${API_BASE}/bulletin/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Token': CLIENT_TOKEN
      },
      body: JSON.stringify(newSubscription)
    });

    console.log('[Bulletin] Push subscription sent to server');
  } catch (error) {
    console.warn('[Bulletin] Push subscription failed:', error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function loadBulletinBoard() {
  const listEl = document.getElementById('bulletin-list');
  if (!listEl) return;

  listEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">読み込み中...</p>';

  try {
    const response = await fetch(`${API_BASE}/bulletin/posts`, {
      headers: {
        'X-Client-Token': CLIENT_TOKEN
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const posts = await response.json();

    if (posts.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">まだ投稿がありません。最初の投稿をしてみてください！</p>';
      return;
    }

    listEl.innerHTML = posts
      .map((post) => {
        const replies = Array.isArray(post.replies) ? post.replies : [];
        const seenCount = getSeenReplyCount(post.id);
        const newReplyCount = post.is_own_post ? Math.max(0, replies.length - seenCount) : 0;
        const repliesHtml = replies.map((reply) => `
          <div style="margin:8px 0 0 18px; padding:10px 12px; background:#f8f9fa; border-left:3px solid #d7d7d7; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:5px;">
              <span style="font-size:13px; font-weight:bold; color:#666;">${escapeHtml(reply.author_name)}</span>
              <span style="margin-left:auto; font-size:11px; color:#999;">${formatPostTime(new Date(reply.created_at).getTime())}</span>
              ${reply.is_own_reply ? `<button onclick="deleteBulletinReply(${reply.id})" style="padding:3px 7px; font-size:11px; background:#fee; color:#c33; border:1px solid #fcc; border-radius:3px; cursor:pointer;">削除</button>` : ''}
            </div>
            <div style="white-space:pre-wrap; word-break:break-word; line-height:1.55; color:#000; font-size:14px;">${escapeHtml(reply.content)}</div>
          </div>
        `).join('');

        return `
        <div style="background:#fff; border-radius:8px; padding:16px; margin-bottom:12px; border:1px solid #e0e0e0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; color:#666;">${escapeHtml(post.author_name)}</span>
            <span style="font-size:12px; color:#999;">${formatPostTime(new Date(post.created_at).getTime())}</span>
            ${post.is_own_post ? `<button onclick="deleteBulletinPost(${post.id})" style="padding:4px 8px; font-size:12px; background:#fee; color:#c33; border:1px solid #fcc; border-radius:3px; cursor:pointer;">削除</button>` : ''}
          </div>
          <p style="margin:0 0 12px 0; white-space:pre-wrap; word-break:break-word; line-height:1.6; color:#000;">${escapeHtml(post.content)}</p>
          <button onclick="toggleLikeBulletin(${post.id})" style="padding:6px 12px; background:${post.liked_by_user ? '#ffcccc' : '#f0f0f0'}; color:${post.liked_by_user ? '#c33' : '#666'}; border:1px solid #ddd; border-radius:4px; cursor:pointer; font-size:12px;">❤️ ${post.likes}</button>
          <button onclick="toggleBulletinReplies(${post.id}, ${replies.length})" style="margin-left:6px; padding:6px 12px; background:#eef5ff; color:#245b91; border:1px solid #c9ddf2; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">
            💬 返信 <span style="display:inline-block; min-width:18px; padding:1px 5px; background:#245b91; color:#fff; border-radius:10px;">${replies.length}</span>
          </button>
          ${newReplyCount > 0 ? `<span style="display:inline-block; margin-left:6px; padding:4px 8px; background:#C0392B; color:#fff; border-radius:12px; font-size:11px; font-weight:bold;">新しい返信 ${newReplyCount}件</span>` : ''}
          <div id="bulletin-replies-${post.id}" style="display:none; margin-top:10px;">
            ${repliesHtml || '<p style="margin:8px 0; color:#888; font-size:13px;">まだ返信はありません。</p>'}
            <div style="margin:10px 0 0 18px; padding:10px; background:#fffaf7; border:1px solid #f1ddd2; border-radius:6px;">
              <input id="bulletin-reply-name-${post.id}" type="text" maxlength="20" placeholder="お名前（任意・匿名OK）" style="width:100%; padding:8px; margin-bottom:7px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-size:13px;">
              <textarea id="bulletin-reply-input-${post.id}" maxlength="500" placeholder="この投稿に返信する" style="width:100%; height:64px; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; resize:vertical; font-family:inherit; font-size:13px;"></textarea>
              <button onclick="submitBulletinReply(${post.id})" style="width:100%; margin-top:7px; padding:8px; background:#245b91; color:#fff; border:0; border-radius:4px; font-weight:bold; cursor:pointer;">返信する</button>
            </div>
          </div>
        </div>
      `;
      }).join('');
  } catch (error) {
    console.error('[Bulletin] loadBulletinBoard error:', error);
    listEl.innerHTML = '<p style="text-align:center; color:#c33; padding:20px;">読み込みに失敗しました。リロードしてください。</p>';
  }
}

function getSeenReplyCount(postId) {
  const value = Number(localStorage.getItem(`bulletin_seen_replies_${postId}`));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function toggleBulletinReplies(postId, replyCount) {
  const repliesEl = document.getElementById(`bulletin-replies-${postId}`);
  if (!repliesEl) return;
  const willOpen = repliesEl.style.display === 'none';
  repliesEl.style.display = willOpen ? 'block' : 'none';
  if (willOpen) {
    localStorage.setItem(`bulletin_seen_replies_${postId}`, String(replyCount));
    const badges = repliesEl.parentElement.querySelectorAll('span');
    badges.forEach((badge) => {
      if (badge.textContent.trim().startsWith('新しい返信')) badge.remove();
    });
  }
}

async function submitBulletinReply(postId) {
  const nameInput = document.getElementById(`bulletin-reply-name-${postId}`);
  const input = document.getElementById(`bulletin-reply-input-${postId}`);
  const content = input?.value.trim() || '';
  const author_name = (nameInput?.value.trim() || '').slice(0, 20) || null;
  if (!content) {
    alert('返信内容を入力してください');
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/bulletin/posts/${postId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Token': CLIENT_TOKEN
      },
      body: JSON.stringify({ author_name, content })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadBulletinBoard();
  } catch (error) {
    console.error('[Bulletin] submitBulletinReply error:', error);
    alert('返信に失敗しました');
  }
}

async function deleteBulletinReply(replyId) {
  if (!confirm('この返信を削除しますか？')) return;
  try {
    const response = await fetch(`${API_BASE}/bulletin/replies/${replyId}`, {
      method: 'DELETE',
      headers: { 'X-Client-Token': CLIENT_TOKEN }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadBulletinBoard();
  } catch (error) {
    console.error('[Bulletin] deleteBulletinReply error:', error);
    alert('返信の削除に失敗しました');
  }
}

async function submitBulletinPost() {
  const nameInput = document.getElementById('bulletin-name');
  const input = document.getElementById('bulletin-input');
  if (!input) return;

  const content = input.value.trim();
  const author_name = (nameInput?.value.trim() || '').slice(0, 20) || null;

  if (!content) {
    alert('投稿内容を入力してください');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/bulletin/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Token': CLIENT_TOKEN
      },
      body: JSON.stringify({ author_name, content })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    input.value = '';
    if (nameInput) nameInput.value = '';
    await loadBulletinBoard();
  } catch (error) {
    console.error('[Bulletin] submitBulletinPost error:', error);
    alert('投稿に失敗しました');
  }
}

async function deleteBulletinPost(postId) {
  if (!confirm('この投稿を削除しますか？')) return;

  try {
    const response = await fetch(`${API_BASE}/bulletin/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'X-Client-Token': CLIENT_TOKEN
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    await loadBulletinBoard();
  } catch (error) {
    console.error('[Bulletin] deleteBulletinPost error:', error);
    alert('削除に失敗しました');
  }
}

async function toggleLikeBulletin(postId) {
  try {
    const response = await fetch(`${API_BASE}/bulletin/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'X-Client-Token': CLIENT_TOKEN
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    await loadBulletinBoard();
  } catch (error) {
    console.error('[Bulletin] toggleLikeBulletin error:', error);
  }
}

function formatPostTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('ja-JP');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 掲示板機能の初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBulletin);
} else {
  initBulletin();
}
