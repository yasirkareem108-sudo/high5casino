const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Sends a push notification to every registered admin device.
// Silently drops (and cleans up) subscriptions the browser has expired/revoked.
async function notifyAdmins(payload) {
  ensureConfigured();
  if (!configured) return;

  const subscriptions = await PushSubscription.find();
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

module.exports = { notifyAdmins };
