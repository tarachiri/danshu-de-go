// 断酒でGO 例会占い（v1）
// スプラッシュ画面のボタンから、現在地から20km以内にある
// 直近3日間（今日・明日・明後日）の例会を距離順に最大5件表示する。
// app.jsが読み込み済みのwindow.VENUESをそのまま使い、
// 追加のネットワーク通信を発生させない（速度・軽量性優先の設計）。
//
// 会員（かんたん会員登録でdisplay_nameを設定済み）は無制限、
// ゲストは1日3回まで（localStorageのみで判定。サーバー永続化なし）。
//
// 依存: window.VENUES（app.js）, window.PinSchedule,
//       window.DanshuBrowserIdentity, window.DanshuProfileApi
// 依存が無い/取得に失敗した場合は「ゲスト扱い」にフォールバックする（サイレント設計）。
(function exposeUranai(root) {
  'use strict';
 
  const GUEST_DRAW_KEY = 'danshu_uranai_draws';
  const GUEST_DRAW_LIMIT = 3;
  const RESULT_COUNT = 5;
  const MAX_DISTANCE_KM = 20;
  const REVEAL_DELAY_MS = 450;
  const GEO_TIMEOUT_MS = 10000;
 
  const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];
 
  // null=未確認, true=会員（無制限）, false=ゲスト（回数制限あり）
  let membershipCache = null;
　// 占い風の演出用。断酒会・回復・支援のイメージに合う前向きな四字熟語を固定リストで用意し、
  // 例会カードごとにランダムで1つ添える（サーバー通信なし、LLM不使用）
  const JUKUGO_LIST = [
    '一期一会', '心機一転', '七転八起', '日々精進', '一歩一歩',
    '初心貫徹', '和気あいあい', '一致団結', '切磋琢磨', '前途洋々',
    '順風満帆', '大願成就', '有言実行', '日進月歩', '温故知新',
    '泰然自若', '笑門来福', '一意専心'
  ];

  function pickJukugo() {
    return JUKUGO_LIST[Math.floor(Math.random() * JUKUGO_LIST.length)];
  }
 
  // ---- 日付・時刻ヘルパー（app.jsのgetTodayJST/getTomorrowJSTと同じ手法。
  //      別ファイルとして自己完結させるためあえて重複実装している） ----
 
  function dateOffsetJST(days, now = new Date()) {
    const jst = new Date(now.getTime() + (9 + 24 * days) * 60 * 60 * 1000);
    return jst.toISOString().split('T')[0];
  }
 
  function todayJST(now = new Date()) {
    return dateOffsetJST(0, now);
  }
 
  // ---- 距離計算 ----
 
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
 
  // ---- 会員判定 ----
 
  function getUserToken() {
    if (!root.DanshuBrowserIdentity) return null;
    try {
      return root.DanshuBrowserIdentity.initialize(root.localStorage, root.crypto).userToken;
    } catch (e) {
      return null;
    }
  }
 
  function checkMembership() {
    if (membershipCache !== null) return Promise.resolve(membershipCache);
    const token = getUserToken();
    if (!root.DanshuProfileApi || !token) {
      membershipCache = false;
      return Promise.resolve(false);
    }
    return root.DanshuProfileApi
      .get(token)
      .then(profile => {
        membershipCache = Boolean(profile);
        return membershipCache;
      })
      .catch(() => {
        membershipCache = false;
        return false;
      });
  }
 
  // ---- ゲストの1日3回カウント（localStorageのみ） ----
 
  function todayGuestDrawCount() {
    try {
      const raw = root.localStorage.getItem(GUEST_DRAW_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== todayJST()) return 0;
      return Number(parsed.count) || 0;
    } catch (e) {
      return 0;
    }
  }
 
  function recordGuestDraw() {
    try {
      const count = todayGuestDrawCount() + 1;
      root.localStorage.setItem(GUEST_DRAW_KEY, JSON.stringify({ date: todayJST(), count: count }));
      return count;
    } catch (e) {
      return null;
    }
  }
 
  // ---- 候補抽出 ----
 
  function candidateKey(candidate) {
    const normalize = root.PinSchedule.normalizeIdentityText;
    return [
      normalize(candidate.prefecture),
      normalize(candidate.facility_name || candidate.address || candidate.venue_id),
      Number(candidate.lat).toFixed(5),
      Number(candidate.lng).toFixed(5),
      candidate.next_date,
      candidate.start_time,
      normalize(candidate.name)
    ].join('|');
  }

  function collectCandidates(venues, now = new Date()) {
    const schedule = root.PinSchedule;
    if (!schedule || typeof schedule.meetingOccurrences !== 'function') return [];
    const targetDates = [
      dateOffsetJST(0, now),
      dateOffsetJST(1, now),
      dateOffsetJST(2, now)
    ];
    const seen = new Set();
    const out = [];
    (venues || []).forEach(v => {
      if (typeof v.lat !== 'number' || typeof v.lng !== 'number') return;
      (v.meetings || []).forEach(m => {
        schedule.meetingOccurrences(m).forEach(occurrence => {
          if (targetDates.indexOf(occurrence.date) === -1) return;
          if (occurrence.cancelled || schedule.isFinished(occurrence.date, occurrence.end_time, now)) return;
          const candidate = {
            meeting_id: m.meeting_id,
            name: m.name || v.meeting_name || '例会',
            next_date: occurrence.date,
            day_of_week: m.day_of_week || '',
            start_time: occurrence.start_time,
            end_time: occurrence.end_time,
            prefecture: v.prefecture || '',
            facility_name: v.facility_name || '',
            address: v.address || '',
            lat: v.lat,
            lng: v.lng,
            official_url: v.official_url || '',
            venue_id: v.id
          };
          const key = candidateKey(candidate);
          if (seen.has(key)) return;
          seen.add(key);
          out.push(candidate);
        });
      });
    });
    return out;
  }
 
  function pickNearby(candidates, lat, lng, maxDistanceKm = MAX_DISTANCE_KM) {
    return candidates
      .map(candidate => ({
        ...candidate,
        distance_km: distanceKm(lat, lng, candidate.lat, candidate.lng)
      }))
      .filter(candidate => candidate.distance_km <= maxDistanceKm)
      .sort((a, b) => a.distance_km - b.distance_km || String(a.start_time).localeCompare(String(b.start_time)))
      .slice(0, RESULT_COUNT);
  }
 
  function pickByPrefecture(candidates, prefecture) {
    const filtered = candidates.filter(c => c.prefecture === prefecture);
    filtered.sort((a, b) => (a.next_date + a.start_time).localeCompare(b.next_date + b.start_time));
    return filtered.slice(0, RESULT_COUNT);
  }
 
  // ---- 位置情報取得 ----
 
  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!root.navigator || !root.navigator.geolocation) {
        reject(new Error('geolocation_unsupported'));
        return;
      }
      root.navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('geolocation_denied')),
        { timeout: GEO_TIMEOUT_MS, maximumAge: 0 }
      );
    });
  }
 
  // ---- 描画 ----
 
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }
 
  function dateLabelShort(dateStr) {
    if (dateStr === todayJST()) return '今日';
    if (dateStr === dateOffsetJST(1)) return '明日';
    return '明後日';
  }
 
  function setStatus(container, message) {
    container.innerHTML = '<p class="sp-uranai-status">' + escapeHtml(message) + '</p>';
  }
 
  function renderResults(container, meetings) {
    container.innerHTML = '';
    if (!meetings.length) {
      container.innerHTML =
        '<p class="sp-uranai-empty">20km以内に開催予定の例会が見つかりませんでした。地図や地域一覧から探してください。</p>';
      return;
    }
    const list = document.createElement('div');
    list.className = 'sp-uranai-list';
    container.appendChild(list);
 
    meetings.forEach((m, i) => {
      setTimeout(() => {
        const card = document.createElement('div');
        card.className = 'sp-uranai-card';
        const distText = typeof m.distance_km === 'number' ? '約' + m.distance_km.toFixed(1) + 'km' : '';
        card.innerHTML =
          '<div class="sp-uranai-card-head">' +
          '<span class="sp-uranai-card-date">' + escapeHtml(dateLabelShort(m.next_date)) + ' ' + escapeHtml(m.start_time || '') + '</span>' +
          (distText ? '<span class="sp-uranai-card-dist">' + escapeHtml(distText) + '</span>' : '') +
          '</div>' +
          '<div class="sp-uranai-card-name">' + escapeHtml(m.name) + '</div>' +
          '<div class="sp-uranai-card-jukugo">「' + escapeHtml(pickJukugo()) + '」</div>' +
          '<div class="sp-uranai-card-venue">' + escapeHtml(m.facility_name) + (m.prefecture ? '（' + escapeHtml(m.prefecture) + '）' : '') + '</div>';
        list.appendChild(card);
        if (i === meetings.length - 1) {
          const note = document.createElement('p');
          note.className = 'sp-uranai-note';
          note.textContent = '日程・会場は変更の場合があります。必ず公式サイトか責任者にご確認ください。';
          container.appendChild(note);
        }
      }, i * REVEAL_DELAY_MS);
    });
  }
 
  function showPrefectureFallback(container, onPick) {
    container.innerHTML = '<p class="sp-uranai-empty">位置情報を取得できませんでした。都道府県を選んでください。</p>';
    const select = document.createElement('select');
    select.className = 'sp-uranai-select';
    const blank = document.createElement('option');
    blank.textContent = '都道府県を選択';
    blank.value = '';
    select.appendChild(blank);
    PREFECTURES.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      if (select.value) onPick(select.value);
    });
    container.appendChild(select);
  }
 
  // ---- エントリポイント ----
 
  function run() {
    const btn = document.getElementById('sp-uranai-btn');
    const result = document.getElementById('sp-uranai-result');
    if (!result) return;
 
    checkMembership().then(isMember => {
      if (!isMember && todayGuestDrawCount() >= GUEST_DRAW_LIMIT) {
        setStatus(
          result,
          '本日のゲスト利用回数（' + GUEST_DRAW_LIMIT + '回）を使い切りました。かんたん会員登録をすると回数無制限で使えます。'
        );
        return;
      }
 
      if (btn) btn.disabled = true;
      setStatus(result, '現在地を確認しています…');
 
      const candidates = collectCandidates(root.VENUES || []);
 
      getLocation()
        .then(loc => {
          if (!isMember) recordGuestDraw();
          const picked = pickNearby(candidates, loc.lat, loc.lng);
          renderResults(result, picked);
          if (btn) btn.disabled = false;
        })
        .catch(() => {
          if (btn) btn.disabled = false;
          showPrefectureFallback(result, prefecture => {
            if (!isMember) recordGuestDraw();
            const picked = pickByPrefecture(candidates, prefecture);
            renderResults(result, picked);
          });
        });
    });
  }
 
  root.DanshuUranai = {
    run,
    collectCandidates,
    pickNearby,
    pickByPrefecture,
    distanceKm,
    MAX_DISTANCE_KM
  };
})(typeof window !== 'undefined' ? window : globalThis);
