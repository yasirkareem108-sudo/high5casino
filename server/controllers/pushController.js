const PushSubscription = require('../models/PushSubscription');
const push = require('../services/push');
const { totalUnread } = require('../services/adminAlerts');

function getPublicKey(req, res) {
  res.json({ publicKey: push.getPublicKey() });
}

async function subscribe(req, res) {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription payload' });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { $set: { endpoint, keys, userAgent: String(req.headers['user-agent'] || '').slice(0, 200), lastError: '' } },
    { upsert: true, returnDocument: 'after' }
  );
  res.status(201).json({ message: 'Subscribed' });
}

async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'endpoint is required' });
  await PushSubscription.deleteOne({ endpoint });
  res.json({ message: 'Unsubscribed' });
}

// Powers the admin's Notifications panel: is the server able to push, and which devices can it reach?
async function status(req, res) {
  const { endpoint } = req.body || {};
  const subscriptions = await PushSubscription.find().sort({ updatedAt: -1 });
  res.json({
    vapid: push.getVapidStatus(),
    thisDeviceRegistered: !!endpoint && subscriptions.some((s) => s.endpoint === endpoint),
    devices: subscriptions.map((s) => ({
      id: s._id,
      service: push.hostOf(s.endpoint),
      userAgent: s.userAgent,
      registeredAt: s.createdAt,
      lastSuccessAt: s.lastSuccessAt || null,
      lastError: s.lastError || '',
      isThisDevice: !!endpoint && s.endpoint === endpoint,
    })),
  });
}

// Sends a real push (same code path as live alerts) so the admin can test a phone end to end.
async function test(req, res) {
  const { endpoint } = req.body || {};
  const summary = await push.notifyAdmins(
    {
      title: '✅ Test notification',
      body: 'Push is working on this device.',
      url: '/admin',
      tag: 'push-test',
      badge: await totalUnread().catch(() => undefined),
    },
    { onlyEndpoint: endpoint || undefined }
  );
  res.json(summary);
}

module.exports = { getPublicKey, subscribe, unsubscribe, status, test };
