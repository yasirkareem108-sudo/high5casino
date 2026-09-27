const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

async function adminLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password || username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
}

async function listConversations(req, res) {
  const conversations = await Conversation.find().sort({ lastMessageAt: -1 });
  res.json(conversations);
}

async function getMessages(req, res) {
  const messages = await Message.find({ conversationId: req.params.id }).sort({ createdAt: 1 });
  res.json(messages);
}

function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
}

module.exports = { adminLogin, listConversations, getMessages, uploadImage };
