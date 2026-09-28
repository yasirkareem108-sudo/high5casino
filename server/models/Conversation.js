const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    email: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    // Unread alerts for the admin (player messages, deposit requests, logins, new sign-ups).
    // Cleared when an admin opens the conversation; the sum across all conversations is the app badge.
    adminUnread: { type: Number, default: 0, min: 0 },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
