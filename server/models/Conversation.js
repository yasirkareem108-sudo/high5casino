const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    email: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
