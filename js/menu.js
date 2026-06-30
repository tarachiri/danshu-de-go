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
