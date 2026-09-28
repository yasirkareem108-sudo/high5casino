const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Helps tell devices apart in the admin's Notifications panel.
    userAgent: { type: String, default: '' },
    lastSuccessAt: { type: Date },
    // Most recent delivery failure ("403: ...") — cleared on the next success.
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
