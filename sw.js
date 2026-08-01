// Service Worker for 断酒でGO!! Push Notifications & Badges

// インストール時
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// アクティベーション時
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});

// Push 通知受信
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data);

  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || '断酒でGO!!';
    const options = {
      body: data.body || '新しい投稿があります',
      icon: '/icon-192.png',
      tag: 'bulletin-notification',
      requireInteraction: false
    };

    // 通知表示 + バッジ更新を並行実行
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        navigator.setAppBadge ? navigator.setAppBadge(data.count || 1) : Promise.resolve()
      ])
    );
  } catch (e) {
    console.error('[SW] Push parse error:', e);
    event.waitUntil(
      self.registration.showNotification('断酒でGO!!', {
        body: '新しい投稿があります',
        icon: '/icon-192.png'
      })
    );
  }
});

// 通知クリック時
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 既に開いているウィンドウがあれば、それにフォーカス + 掲示板へ移動
      for (let client of clientList) {
        if (client.url && client.url.includes('dansyu-go')) {
          client.focus();
          client.postMessage({ action: 'navigate-to-bulletin' });
          return;
        }
      }
      // なければ新規ウィンドウを開く
      return clients.openWindow('/#bulletin');
    })
  );
});

// メッセージ受信（フロントからの指示）
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.action === 'clear-badge') {
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge();
    }
  }
});
