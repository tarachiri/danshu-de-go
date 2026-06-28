// schedule.js - 日程タブ機能
// 断酒でGO!! - アルコール依存症回復支援アプリ
// app.js から分離 (2026-06)

const Schedule = {

  // ── 状態 ──────────────────────────────────────────
  _prefFilter: 'all',   // 'all' or '東京都' など
  _rendered: false,
  _data: null,          // fetch済みキャッシュ

  // ── 近隣都道府県テーブル ───────────────────────────
  ADJACENT: {
    '北海道': [],
    '青森県': ['岩手県','秋田県','北海道'],
    '岩手県': ['青森県','秋田県','宮城県'],
    '宮城県': ['岩手県','山形県','福島県'],
    '秋田県': ['青森県','岩手県','宮城県','山形県'],
    '山形県': ['秋田県','宮城県','福島県','新潟県'],
    '福島県': ['宮城県','山形県','茨城県','栃木県','群馬県','新潟県'],
    '茨城県': ['福島県','栃木県','埼玉県','千葉県'],
    '栃木県': ['福島県','茨城県','群馬県','埼玉県'],
    '群馬県': ['福島県','栃木県','埼玉県','新潟県','長野県'],
    '埼玉県': ['茨城県','栃木県','群馬県','千葉県','東京都','山梨県','長野県'],
    '千葉県': ['茨城県','埼玉県','東京都'],
    '東京都': ['埼玉県','千葉県','神奈川県','山梨県'],
    '神奈川県': ['東京都','山梨県','静岡県'],
    '新潟県': ['山形県','福島県','群馬県','長野県','富山県'],
    '富山県': ['新潟県','長野県','岐阜県','石川県'],
    '石川県': ['富山県','岐阜県','福井県'],
    '福井県': ['石川県','岐阜県','滋賀県','京都府'],
    '山梨県': ['埼玉県','東京都','神奈川県','長野県','静岡県'],
    '長野県': ['群馬県','埼玉県','新潟県','富山県','岐阜県','山梨県','静岡県','愛知県'],
    '岐阜県': ['富山県','石川県','福井県','長野県','愛知県','三重県','滋賀県'],
    '静岡県': ['神奈川県','山梨県','長野県','愛知県'],
    '愛知県': ['長野県','岐阜県','静岡県','三重県'],
    '三重県': ['岐阜県','愛知県','滋賀県','京都府','奈良県','和歌山県'],
    '滋賀県': ['福井県','岐阜県','三重県','京都府'],
    '京都府': ['福井県','三重県','滋賀県','大阪府','兵庫県','奈良県'],
    '大阪府': ['京都府','兵庫県','奈良県','和歌山県'],
    '兵庫県': ['京都府','大阪府','奈良県','鳥取県','岡山県'],
    '奈良県': ['三重県','京都府','大阪府','和歌山県'],
    '和歌山県': ['三重県','大阪府','奈良県'],
    '鳥取県': ['兵庫県','岡山県','島根県'],
    '島根県': ['鳥取県','岡山県','広島県','山口県'],
    '岡山県': ['兵庫県','鳥取県','島根県','広島県'],
    '広島県': ['島根県','岡山県','山口県'],
    '山口県': ['島根県','広島県','福岡県'],
    '徳島県': ['香川県','愛媛県','高知県'],
    '香川県': ['徳島県','愛媛県'],
    '愛媛県': ['香川県','徳島県','高知県'],
    '高知県': ['徳島県','愛媛県'],
    '福岡県': ['山口県','佐賀県','熊本県','大分県'],
    '佐賀県': ['福岡県','長崎県'],
    '長崎県': ['佐賀県'],
    '熊本県': ['福岡県','大分県','宮崎県','鹿児島県'],
    '大分県': ['福岡県','熊本県','宮崎県'],
    '宮崎県': ['熊本県','大分県','鹿児島県'],
    '鹿児島県': ['熊本県','宮崎県'],
    '沖縄県': [],
  },

  // ── 外部API ───────────────────────────────────────

  // GPS・セレクトから呼ぶ
  setFilter(pref) {
    this._prefFilter = pref;
    this._rendered = false;
    const sel = document.getElementById('sch-pref-filter');
    if (sel) sel.value = pref;
    if (document.getElementById('schedule').style.display !== 'none') {
      this.render();
    }
  },

  // タブ切替から呼ぶ
  render() {
    if (this._rendered) return;
    this._rendered = true;
    const container = document.getElementById('schedule');
    container.innerHTML = '';

    // フィルターバー
    container.appendChild(this._buildFilterBar());

    // リストエリア
    const listEl = document.createElement('div');
    listEl.id = 'sch-list';
    listEl.style.cssText = 'padding:0 0 80px 0;';
    listEl.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">読み込み中...</div>';
    container.appendChild(listEl);

    // データ取得（キャッシュあれば再利用）
    const load = this._data
      ? Promise.resolve(this._data)
      : fetch('schedule.json?v=' + Date.now()).then(r => r.json()).then(d => { this._data = d; return d; });

    load
      .then(data => this._renderAll(data, listEl))
      .catch(() => {
        listEl.innerHTML = '<div style="color:#e94560;text-align:center;padding:32px;">取得エラー</div>';
      });
  },

  // 再描画
  reset() {
    this._rendered = false;
    this.render();
  },

  // ── 内部メソッド ──────────────────────────────────

  _buildFilterBar() {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1a1a2e;position:sticky;top:0;z-index:10;border-bottom:1px solid #0f3460;';

    const icon = document.createElement('span');
    icon.textContent = '📍';
    icon.style.fontSize = '18px';

    const sel = document.createElement('select');
    sel.id = 'sch-pref-filter';
    sel.style.cssText = 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid #0f3460;background:#0f3460;color:#fff;font-size:15px;';

    // 全国
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = '🗾 全国';
    sel.appendChild(optAll);

    // 47都道府県
    const PREFS = [
      '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
      '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
      '新潟県','富山県','石川県','福井県','山梨県','長野県',
      '岐阜県','静岡県','愛知県','三重県',
      '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
      '鳥取県','島根県','岡山県','広島県','山口県',
      '徳島県','香川県','愛媛県','高知県',
      '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
    ];
    PREFS.forEach(pref => {
      const opt = document.createElement('option');
      opt.value = pref;
      opt.textContent = pref;
      sel.appendChild(opt);
    });

    sel.value = this._prefFilter;
    sel.addEventListener('change', () => {
      this._prefFilter = sel.value;
      this._rendered = false;
      this.render();
    });

    bar.appendChild(icon);
    bar.appendChild(sel);
    return bar;
  },

  _renderAll(data, listEl) {
    if (this._prefFilter === 'all') {
      // 全国表示（従来通り）
      this._renderSection(data, listEl, null);
      return;
    }

    // 自都道府県
    const mainData = data.filter(e => e.prefecture === this._prefFilter);
    // 近隣都道府県
    const adjPrefs = this.ADJACENT[this._prefFilter] || [];
    const adjData  = data.filter(e => adjPrefs.includes(e.prefecture));

    if (mainData.length === 0 && adjData.length === 0) {
      listEl.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">この地域の例会情報はありません</div>';
      return;
    }

    let html = '';

    // ── 自都道府県セクション ──
    html += `<div class="sch-section-header">${this._prefFilter}の例会</div>`;
    if (mainData.length === 0) {
      html += '<div style="color:#a0a0b0;text-align:center;padding:16px;">例会情報がありません</div>';
    } else {
      html += this._buildDateHtml(mainData);
    }

    // ── 近隣都道府県セクション ──
    if (adjPrefs.length > 0) {
      html += `<div class="sch-section-header" style="margin-top:8px;">近隣の例会</div>`;
      adjPrefs.forEach(pref => {
        const prefData = adjData.filter(e => e.prefecture === pref);
        if (prefData.length === 0) return;
        html += `
          <details class="sch-adj-details">
            <summary class="sch-adj-summary">
              <span class="sch-pref-badge" style="${getPrefBadgeStyle(pref)}">${getPrefBadgeLabel(pref)}</span>
              <span style="margin-left:8px;">${pref}</span>
              <span class="sch-date-count" style="margin-left:auto;">${prefData.length}件</span>
            </summary>
            <div class="sch-adj-body">${this._buildDateHtml(prefData)}</div>
          </details>`;
      });
    }

    listEl.innerHTML = html;
  },

  _buildDateHtml(data) {
    const today = getTodayJST();
    const byDate = {};
    data.forEach(e => {
      const d = e.next_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(e);
    });

    let html = '';
    Object.keys(byDate).sort().forEach(date => {
      const evs = byDate[date];
      const isToday = date === today;
      const dateLabel = date.replace(/^\d{4}-/, '').replace('-', '/') +
        '（' + ['日','月','火','水','木','金','土'][new Date(date + 'T00:00:00+09:00').getDay()] + '）';
      html += `<div class="sch-date-header"><span>${dateLabel}</span>${isToday ? '<span class="sch-date-today">今日</span>' : ''}<span class="sch-date-count">${evs.length}件</span></div>`;
      evs.forEach(e => { html += this._buildCard(e); });
    });
    return html;
  },

  _buildCard(e) {
    const clickAttr = (e.latitude && e.longitude)
      ? ` onclick="jumpToMarker(${e.id}, ${e.latitude}, ${e.longitude}, '${(e.meeting_name || '').replace(/['"]/g, '')}')" style="cursor:pointer;"`
      : '';
    return `<div class="sch-card"${clickAttr}>
      <div class="sch-time">
        <div class="sch-time-start">${e.start_time || ''}</div>
        <div class="sch-time-end" style="font-size:14px;color:#888;">${e.end_time || ''}</div>
      </div>
      <div class="sch-info">
        <div class="sch-name">${e.meeting_name}</div>
        <div class="sch-loc">📍 ${e.address || ''}</div>
      </div>
      <span class="sch-pref-badge" style="${getPrefBadgeStyle(e.prefecture)}">${getPrefBadgeLabel(e.prefecture)}</span>
    </div>`;
  },

  _renderSection(data, listEl, pref) {
    // 全国表示用（全データをそのまま日付順に）
    if (data.length === 0) {
      listEl.innerHTML = '<div style="color:#a0a0b0;text-align:center;padding:32px;">例会情報がありません</div>';
      return;
    }
    listEl.innerHTML = this._buildDateHtml(data);
  },
};

// 都道府県バッジ（app.jsから移動）
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
