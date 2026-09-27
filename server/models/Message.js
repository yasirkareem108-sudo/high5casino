const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    type: { type: String, enum: ['text', 'image', 'deposit_card'], default: 'text' },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
