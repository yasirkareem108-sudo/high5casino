// High 5 Casino service worker — enables PWA install + Web Push for the admin panel.
// Deliberately minimal: no offline asset caching, just push handling.

const DIAG_CACHE = 'h5-diag';
const DIAG_KEY = '/__diag/last-push';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Applies the app-icon badge. Returns what happened so it can be reported in the admin panel.
async function applyBadge(count) {
  const nav = self.navigator;
  if (!nav || !('setAppBadge' in nav)) return 'unsupported';
  try {
    if (count > 0) {
      await nav.setAppBadge(count);
      return 'set';
    }
    await nav.clearAppBadge();
    return 'cleared';
  } catch {
    return 'error';
  }
}

// Leaves a small receipt of the most recent push so the admin panel can prove the phone
// received it even while the app was closed. Never allowed to break the push itself.
async function recordDiagnostics(info) {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(DIAG_CACHE);
    await cache.put(DIAG_KEY, new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    // diagnostics are best-effort
  }
}

self.addEventListener('push', (event) => {
  let data = { title: 'High 5 Casino', body: 'You have a new notification', url: '/admin' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to defaults
  }

  event.waitUntil(
    (async () => {
      const info = {
        receivedAt: Date.now(),
        title: data.title,
        badgeValue: typeof data.badge === 'number' ? data.badge : null,
        notification: 'pending',
        badge: 'skipped',
      };

      // Every push must produce a visible notification (iOS revokes the subscription otherwise).
      // The alert sound is decided by the phone's notification settings for this app —
      // a web notification cannot pick its own tone, only ask not to be silent and to vibrate.
      try {
        await self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          silent: false,
          vibrate: [300, 120, 300, 120, 300],
          tag: data.tag || undefined,
          renotify: !!data.tag,
          data: { url: data.url || '/admin' },
        });
        info.notification = 'shown';
      } catch (err) {
        info.notification = `error: ${err && err.message}`;
      }

      // The server sends the admin's total unread count with each push, so the icon badge
      // stays right even while the app is closed.
      if (info.badgeValue !== null) info.badge = await applyBadge(info.badgeValue);

      await recordDiagnostics(info);
    })()
  );
});

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
