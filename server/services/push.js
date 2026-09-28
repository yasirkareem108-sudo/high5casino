const crypto = require('crypto');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Env values pasted into a dashboard often carry a trailing newline, spaces or quotes.
// web-push rejects such keys outright, which used to make every push fail silently.
const cleanKey = (v) => (typeof v === 'string' ? v.replace(/[\s"']/g, '') : '');
const cleanText = (v) => (typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '').trim() : '');

function readConfig() {
  return {
    publicKey: cleanKey(process.env.VAPID_PUBLIC_KEY),
    privateKey: cleanKey(process.env.VAPID_PRIVATE_KEY),
    subject: cleanText(process.env.VAPID_SUBJECT) || 'mailto:admin@example.com',
  };
}

// The (sanitised) public key clients must subscribe with.
function getPublicKey() {
  return readConfig().publicKey;
}

// Everything that could stop a push from being sent, in one place, for logs and the admin panel.
function getVapidStatus() {
  const { publicKey, privateKey, subject } = readConfig();
  const problems = [];
  const status = { configured: false, keysMatch: false, publicKeyLength: publicKey.length, subject, problems };

  if (!publicKey || !privateKey) {
    problems.push('VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY are not set');
    return status;
  }

  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    status.keysMatch = ecdh.getPublicKey().toString('base64url') === publicKey;
    if (!status.keysMatch) problems.push('VAPID public and private keys are not a matching pair');
  } catch {
    problems.push('VAPID_PRIVATE_KEY is not a valid key');
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    status.configured = status.keysMatch;
  } catch (err) {
    problems.push(err.message);
  }

  if (!/^(mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/\S+)$/.test(subject)) {
    problems.push('VAPID_SUBJECT should be mailto:you@yourdomain.com or an https:// URL');
    status.configured = false;
  } else if (/\.(local|localhost|test|invalid)$/i.test(subject.replace(/^mailto:[^@]*@/, ''))) {
    problems.push('VAPID_SUBJECT uses a non-public domain; Apple\'s push service may reject it — use a real address');
  }
  return status;
}

const hostOf = (endpoint) => {
  try { return new URL(endpoint).host; } catch { return 'unknown'; }
};

// Sends a push to every registered admin device (or just one endpoint, for the test button).
// Never throws; returns a summary so callers and the admin UI can see exactly what happened.
async function notifyAdmins(payload, { onlyEndpoint } = {}) {
  const vapid = getVapidStatus();
  if (!vapid.configured) {
    console.error('[push] NOT sending — VAPID configuration problem:', vapid.problems.join('; '));
    return { configured: false, problems: vapid.problems, attempted: 0, sent: 0, removed: 0, failed: [] };
  }

  const subscriptions = await PushSubscription.find(onlyEndpoint ? { endpoint: onlyEndpoint } : {});
  const message = JSON.stringify(payload);
  const summary = { configured: true, attempted: subscriptions.length, sent: 0, removed: 0, failed: [] };

  await Promise.all(
    subscriptions.map(async (sub) => {
      const host = hostOf(sub.endpoint);
      try {
        // urgency 'high' asks the push service to wake a sleeping phone promptly instead of batching.
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, message, {
          TTL: 60 * 60 * 24,
          urgency: 'high',
        });
        summary.sent += 1;
        await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSuccessAt: new Date(), lastError: '' } });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // The browser says this subscription is gone for good.
          summary.removed += 1;
          await PushSubscription.deleteOne({ _id: sub._id });
          console.warn(`[push] removed expired subscription (${host}, HTTP ${err.statusCode})`);
          return;
        }
        const detail = `${err.statusCode || 'network'}: ${String(err.body || err.message || '').slice(0, 160)}`;
        summary.failed.push({ host, status: err.statusCode || null, message: detail });
        console.error(`[push] delivery to ${host} failed — ${detail}`);
        await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastError: detail } }).catch(() => {});
      }
    })
  );
  return summary;
}

module.exports = { notifyAdmins, getVapidStatus, getPublicKey, hostOf };
