self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('fetch', e => {
  // 外部ドメインはService Workerを通さず直接fetch
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }
  e.respondWith(fetch(e.request));
});