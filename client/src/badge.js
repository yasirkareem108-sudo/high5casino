// App-icon badge for the admin PWA.
//
// Uses the Badging API (navigator.setAppBadge) where it exists: Chrome/Edge on desktop and
// Android for an installed app, and installed Home Screen apps on recent iOS. Where it doesn't
// (Firefox, browsers that haven't shipped it, plain tabs), the count still shows in the tab
// title — "(3) High 5 Casino …" — so there's always some visible signal.

const BASE_TITLE = typeof document !== 'undefined' ? document.title.replace(/^\(\d+\)\s*/, '') : '';

export function badgeSupported() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator && 'clearAppBadge' in navigator;
}

export async function setBadge(count) {
  const n = Math.max(0, Math.floor(Number(count)) || 0);

  if (typeof document !== 'undefined') {
    document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${BASE_TITLE}` : BASE_TITLE;
  }

  if (!badgeSupported()) return false;
  try {
    if (n > 0) await navigator.setAppBadge(n);
    else await navigator.clearAppBadge();
    return true;
  } catch {
    // The API exists but was refused (e.g. app not installed, or notification permission
    // not granted on iOS). The title fallback above already covers it.
    return false;
  }
}

export function clearBadge() {
  return setBadge(0);
}
