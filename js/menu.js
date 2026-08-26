// menu.js - 右下メニュー・PWA追加案内・共有機能
// app.js から分離 (2026-06)

const SITE_URL = 'https://dansyu-go.nukadokonokai.com';
const SITE_TEXT = '🏃断酒でGO！今日・明日の断酒例会場をすぐ探せるマップ\n';

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

function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

// ═══════════════════════════════════════════
// かんたん会員登録（簡易版）
// ═══════════════════════════════════════════

function getUserToken() {
  if (!window.DanshuBrowserIdentity) return null;
  try {
    return window.DanshuBrowserIdentity.initialize(localStorage, window.crypto).userToken;
  } catch (e) {
    return null;
  }
}

function escapeAttr(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[ch]));
}

function setProfileMenuLabel(registered) {
  const el = document.getElementById('menu-item-profile');
  if (!el) return;
  el.innerHTML = registered ? '👤 プロフィール' : '👤 プロフィール・会員登録';
}

function showToast(message, kind) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: ${kind === 'error' ? '#C0392B' : '#27AE60'};
    color: #fff;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 15px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 80vw;
    text-align: center;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function closeProfileModal() {
  const existing = document.getElementById('profile-modal-overlay');
  if (existing) existing.remove();
}

function formatActivityDate(value) {
  if (!value) return '記録開始前';
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric'
  }).format(date);
}

function renderActivitySection(activity, globalSummary) {
  if (!activity || !activity.periods) {
    return '<div style="color:#888;font-size:13px;margin-bottom:18px;">探索記録は準備中です</div>';
  }
  const badges = Array.isArray(activity.badges) ? activity.badges : [];
  const badgesHtml = badges.length
    ? badges.map(b => `
        <div style="background:#0f1428;border:1px solid #5D4A1F;border-radius:10px;padding:10px;">
          <div style="font-size:18px;">🏅 ${escapeAttr(b.title || '')}</div>
          <div style="font-size:12px;color:#aaa;margin-top:4px;">${escapeAttr(b.description || '')}</div>
        </div>`).join('')
    : '<div style="color:#888;font-size:13px;">会場を探索するとバッジが増えていきます</div>';
  return `
    <section id="profile-activity" style="margin-bottom:22px;">
      <div style="font-size:16px;font-weight:bold;margin-bottom:10px;">🗺️ あなたの探索記録</div>
      <div style="font-size:13px;color:#bbb;margin-bottom:10px;">使い始めた日　${escapeAttr(formatActivityDate(activity.started_at))}</div>
      <div style="display:flex;gap:5px;margin-bottom:10px;">
        ${[['today','今日'],['week','今週'],['month','今月'],['total','累計']].map(([key,label]) =>
          `<button type="button" class="activity-period-btn" data-period="${key}" style="flex:1;padding:7px 2px;border:1px solid #0f3460;border-radius:8px;background:${key === 'total' ? '#0f3460' : 'transparent'};color:#fff;">${label}</button>`
        ).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;text-align:center;">
        <div style="background:#0f1428;border-radius:8px;padding:9px 3px;"><div id="activity-visits" style="font-size:20px;font-weight:bold;">0</div><div style="font-size:11px;color:#aaa;">訪問日数</div></div>
        <div style="background:#0f1428;border-radius:8px;padding:9px 3px;"><div id="activity-venues" style="font-size:20px;font-weight:bold;">0</div><div style="font-size:11px;color:#aaa;">見た会場</div></div>
        <div style="background:#0f1428;border-radius:8px;padding:9px 3px;"><div id="activity-pins" style="font-size:20px;font-weight:bold;">0</div><div style="font-size:11px;color:#aaa;">ピンタップ</div></div>
      </div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px;">🌏 みんなの記録</div>
      <div style="background:#0f1428;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#ccc;">
        訪問 <strong id="global-visits" style="color:#fff;">0</strong>　
        ピンタップ <strong id="global-pins" style="color:#fff;">0</strong>
      </div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px;">🏅 キリ番・探索バッジ</div>
      <div style="display:grid;gap:7px;">${badgesHtml}</div>
    </section>`;
}

function openProfileModal(profile, activity, globalSummary) {
  closeProfileModal();
  const isEdit = Boolean(profile);

  const overlay = document.createElement('div');
  overlay.id = 'profile-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1a1a2e;color:#fff;padding:24px;width:100%;border-top:3px solid #C0392B;border-radius:16px 16px 0 0;max-height:85vh;overflow-y:auto;box-sizing:border-box;';

  const title = isEdit ? '👤 プロフィール' : '📝 かんたん会員登録';
  const fieldStyle = 'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #0f3460;background:#0f1428;color:#fff;font-size:16px;margin-bottom:16px;';

  modal.innerHTML = `
    <div style="font-size:20px;font-weight:bold;color:#e94560;margin-bottom:16px;">${title}</div>
    ${renderActivitySection(activity, globalSummary)}
    <div style="font-size:16px;font-weight:bold;margin-bottom:12px;">${isEdit ? '✏️ 登録情報' : '登録情報'}</div>
    <label style="display:block;font-size:14px;color:#ccc;margin-bottom:6px;">表示名（必須・30文字まで）</label>
    <input id="profile-display-name" type="text" maxlength="30" value="${escapeAttr(profile && profile.display_name)}" style="${fieldStyle}">
    <label style="display:block;font-size:14px;color:#ccc;margin-bottom:6px;">都道府県（任意）</label>
    <input id="profile-prefecture" type="text" placeholder="例: 埼玉県" value="${escapeAttr(profile && profile.prefecture)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #0f3460;background:#0f1428;color:#fff;font-size:16px;margin-bottom:6px;">
    <div style="font-size:13px;color:#888;line-height:1.6;margin-bottom:16px;">
      都道府県を入力しておくと、お住まいの地域に近い例会を優先的に表示できるようになります。あとからいつでも登録・変更できるので、今すぐ分からなければ空欄のままで大丈夫です。
    </div>
    <label style="display:block;font-size:14px;color:#ccc;margin-bottom:6px;">市区町村（任意）</label>
    <input id="profile-city" type="text" placeholder="例: さいたま市" value="${escapeAttr(profile && profile.city)}" style="${fieldStyle}">
    <div id="profile-error" style="display:none;font-size:14px;color:#e94560;margin-bottom:8px;"></div>
    <button id="profile-save-btn" style="width:100%;padding:12px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:bold;margin-top:8px;">保存する</button>
    <button id="profile-cancel-btn" style="width:100%;padding:12px;background:transparent;color:#ccc;border:1px solid #0f3460;border-radius:8px;font-size:16px;margin-top:8px;">キャンセル</button>
  `;

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProfileModal(); });
  document.body.appendChild(overlay);

  if (activity && activity.periods) {
    const setPeriod = period => {
      const own = activity.periods[period] || {};
      const all = (globalSummary && globalSummary.periods && globalSummary.periods[period]) || {};
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString('ja-JP'); };
      setText('activity-visits', own.visits);
      setText('activity-venues', own.venues);
      setText('activity-pins', own.pin_taps);
      setText('global-visits', all.visitors);
      setText('global-pins', all.pin_taps);
      document.querySelectorAll('.activity-period-btn').forEach(btn => {
        btn.style.background = btn.dataset.period === period ? '#0f3460' : 'transparent';
      });
    };
    document.querySelectorAll('.activity-period-btn').forEach(btn => {
      btn.addEventListener('click', () => setPeriod(btn.dataset.period));
    });
    setPeriod('total');
  }

  const nameInput = document.getElementById('profile-display-name');
  const prefInput = document.getElementById('profile-prefecture');
  const cityInput = document.getElementById('profile-city');
  const saveBtn = document.getElementById('profile-save-btn');
  const cancelBtn = document.getElementById('profile-cancel-btn');
  const errorBox = document.getElementById('profile-error');

  function updateSaveState() {
    const disabled = !nameInput.value.trim();
    saveBtn.disabled = disabled;
    saveBtn.style.opacity = disabled ? '0.5' : '1';
    saveBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }
  nameInput.addEventListener('input', updateSaveState);
  updateSaveState();

  cancelBtn.addEventListener('click', closeProfileModal);

  saveBtn.addEventListener('click', () => {
    if (!nameInput.value.trim() || !window.DanshuProfileApi) return;
    const token = getUserToken();
    if (!token) return;

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
    errorBox.style.display = 'none';

    window.DanshuProfileApi.update(token, {
      display_name: nameInput.value,
      prefecture: prefInput.value,
      city: cityInput.value
    }).then(result => {
      if (!result) {
        errorBox.textContent = '時間をおいて再度お試しください';
        errorBox.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = '保存する';
        return;
      }
      closeProfileModal();
      showToast(isEdit ? '更新しました' : '登録しました');
      setProfileMenuLabel(true);
    });
  });
}

function openProfileModalFresh() {
  const token = getUserToken();
  if (!window.DanshuProfileApi || !token) {
    openProfileModal(null, null, null);
    return;
  }
  // 初回訪問の登録とプロフィール取得が競合すると、登録直後だけ探索記録が
  // 「準備中」になるため、訪問登録が終わってから3件を並列取得する。
  Promise.resolve(window.DanshuActivityVisitReady)
    .catch(() => null)
    .then(() => {
      const activityRequest = window.DanshuActivityApi
        ? window.DanshuActivityApi.getProfile(token) : Promise.resolve(null);
      const globalRequest = window.DanshuActivityApi
        ? window.DanshuActivityApi.getSummary() : Promise.resolve(null);
      return Promise.all([window.DanshuProfileApi.get(token), activityRequest, globalRequest]);
    })
    .then(([profile, activity, globalSummary]) => {
      setProfileMenuLabel(Boolean(profile));
      openProfileModal(profile, activity, globalSummary);
    });
}

function checkInitialProfileLabel() {
  const token = getUserToken();
  if (!window.DanshuProfileApi || !token) return;
  window.DanshuProfileApi.get(token).then(profile => setProfileMenuLabel(Boolean(profile)));
}

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
    { icon: '📨', label: '例会情報を送る', action: () => { closeMenu(); window.open('gogo-submit.html', '_blank'); } },
    { icon: '🤖', label: 'かもちゃんに相談', action: () => { closeMenu(); window.open('chat.html', '_blank'); } },
  ];

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
    if (item.id) el.id = item.id;
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkInitialProfileLabel);
} else {
  checkInitialProfileLabel();
}
