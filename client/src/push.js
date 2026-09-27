import { API_BASE } from './socket';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

// Subscribes this browser to Web Push and registers it with the backend.
// Safe to call repeatedly — it's a no-op if push isn't supported or permission is denied.
export async function subscribeAdminToPush(adminToken) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await registerServiceWorker();
    if (!registration) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const keyRes = await fetch(`${API_BASE}/api/push/public-key`);
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch {
    // push isn't critical to the app working — fail silently
  }
}
