import { API_BASE, safeJson } from './socket';

const DIAG_CACHE = 'h5-diag';
const DIAG_KEY = '/__diag/last-push';

function urlBase64ToUint8Array(base64String) {
  const clean = base64String.replace(/\s/g, '');
  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function sameBytes(buffer, bytes) {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
}

// What this device/browser can do, for the admin's Notifications panel.
export function getPushEnvironment() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return {
    isIOS,
    standalone,
    supported,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    badgeSupported: 'setAppBadge' in navigator,
  };
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
    // subscribe() needs an *active* worker, not just a registered one.
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function fetchServerKey() {
  const res = await fetch(`${API_BASE}/api/push/public-key`);
  const { publicKey } = await safeJson(res);
  return publicKey;
}

// Makes sure this browser holds a push subscription made with the server's *current* key, and that
// the server knows about it. Throws with a human-readable reason on any failure (never silent).
// Does NOT ask for permission — see enablePush for that.
export async function syncSubscription(adminToken) {
  const registration = await registerServiceWorker();
  if (!registration) throw new Error('This browser could not start the notification service worker.');

  const publicKey = await fetchServerKey();
  if (!publicKey) throw new Error('The server has no push key configured.');
  const wanted = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older key can never receive pushes signed with the new one.
  if (subscription && !sameBytes(subscription.options?.applicationServerKey, wanted)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
  }

  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? 'Your admin login has expired — log in again, then retry.'
        : `The server refused this device's subscription (HTTP ${res.status}).`
    );
  }
  return subscription;
}

// Must be called from a tap/click: iPhones ignore permission prompts that aren't user-initiated.
export async function enablePush(adminToken) {
  const env = getPushEnvironment();
  if (!env.supported) {
    throw new Error(
      env.isIOS && !env.standalone
        ? 'On iPhone, first tap Share → "Add to Home Screen", then open the app from your home screen.'
        : 'This browser does not support push notifications.'
    );
  }
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('Notifications are blocked for this app. Turn them on in your phone/browser settings, then try again.');
  }
  if (permission !== 'granted') throw new Error('Permission was dismissed — tap Enable again and choose Allow.');
  return syncSubscription(adminToken);
}

// Runs automatically when the admin opens the dashboard. Only refreshes an already-allowed
// subscription (registers it with the server, heals a stale key); never prompts.
export async function ensureSubscription(adminToken) {
  if (!getPushEnvironment().supported || Notification.permission !== 'granted') return null;
  try {
    return await syncSubscription(adminToken);
  } catch {
    return null; // the Notifications panel surfaces the reason when the admin looks
  }
}

export async function currentEndpoint() {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    return (await registration?.pushManager.getSubscription())?.endpoint || null;
  } catch {
    return null;
  }
}

async function authedPost(path, adminToken, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function fetchPushStatus(adminToken) {
  return authedPost('/api/push/status', adminToken, { endpoint: await currentEndpoint() });
}

export async function sendTestPush(adminToken) {
  return authedPost('/api/push/test', adminToken, { endpoint: await currentEndpoint() });
}

// The receipt the service worker leaves each time it handles a push (works while the app is closed).
export async function readLastPush() {
  try {
    const cache = await caches.open(DIAG_CACHE);
    const response = await cache.match(DIAG_KEY);
    return response ? await response.json() : null;
  } catch {
    return null;
  }
}
