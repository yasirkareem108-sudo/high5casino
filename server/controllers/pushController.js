const PushSubscription = require('../models/PushSubscription');

function getPublicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
}

async function subscribe(req, res) {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription payload' });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys },
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

module.exports = { getPublicKey, subscribe, unsubscribe };
