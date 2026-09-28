// High 5 Casino service worker — enables PWA install + Web Push for the admin panel.
// Deliberately minimal: no offline asset caching, just push handling.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'High 5 Casino', body: 'You have a new notification', url: '/admin' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to defaults
  }

  const tasks = [
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/admin' },
    }),
  ];
  // The server sends the admin's total unread count with each push, so the app icon badge
  // stays right even while the app is closed. Silently a no-op where the Badging API is missing.
  if (typeof data.badge === 'number') tasks.push(setAppBadge(data.badge));
  event.waitUntil(Promise.all(tasks));
});

function setAppBadge(count) {
  const nav = self.navigator;
  if (!nav || !('setAppBadge' in nav)) return Promise.resolve();
  try {
    return Promise.resolve(count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
