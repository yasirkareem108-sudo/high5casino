const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { notifyAdmins } = require('../services/push');

function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    socket.isAdmin = false;

    // Admin dashboard authenticates its socket with the JWT from login
    socket.on('admin:auth', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') throw new Error('Not an admin token');
        socket.isAdmin = true;
        socket.join('admins');
        socket.emit('admin:authed');
      } catch (err) {
        socket.emit('admin:auth_error', 'Invalid or expired token');
      }
    });

    // Player opens the support chat widget — find or create their conversation
    socket.on('user:join', async ({ userId, userName }) => {
      if (!userId) return;
      try {
        let conversation = await Conversation.findOne({ userId });
        if (!conversation) {
          conversation = await Conversation.create({ userId, userName: userName || 'Guest' });
          io.to('admins').emit('conversation:new', conversation);
        }
        socket.conversationId = conversation._id.toString();
        socket.join(`conv:${conversation._id}`);
        const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
        socket.emit('user:joined', { conversationId: conversation._id, messages });
      } catch (err) {
        socket.emit('error:message', 'Could not start conversation');
      }
    });

    // Admin opens a specific conversation from the inbox list
    socket.on('admin:join_conversation', (conversationId) => {
      if (!socket.isAdmin || !conversationId) return;
      socket.join(`conv:${conversationId}`);
    });

    // Once a player logs in, attach their real name/email to their existing conversation
    socket.on('user:identify', async ({ userId, name, email }) => {
      if (!userId || !name || !email) return;
      try {
        const conversation = await Conversation.findOneAndUpdate(
          { userId },
          { userName: name, email },
          { new: true }
        );
        if (conversation) {
          io.to('admins').emit('conversation:update', {
            conversationId: conversation._id,
            userName: conversation.userName,
            email: conversation.email,
            lastMessageText: conversation.lastMessageText,
            lastMessageAt: conversation.lastMessageAt,
          });
        }
      } catch (err) {
        // non-critical — chat still works under the previous name
      }
    });

    socket.on('user:message', async ({ conversationId, text, imageUrl, meta, type }) => {
      if (!conversationId) return;
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const resolvedType = type || (meta ? 'deposit_card' : imageUrl ? 'image' : 'text');
        // Attach whatever identity the conversation currently has (guest or logged-in) to deposit cards
        const enrichedMeta =
          resolvedType === 'deposit_card'
            ? { ...meta, name: conversation.userName, email: conversation.email || null }
            : meta || null;

        const message = await Message.create({
          conversationId,
          sender: 'user',
          type: resolvedType,
          text: text || '',
          imageUrl: imageUrl || '',
          meta: enrichedMeta,
        });

        const preview =
          resolvedType === 'deposit_card' ? `💳 Deposit request: $${meta?.amount}` : imageUrl ? '📷 Image' : text;

        conversation.lastMessageText = preview;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        io.to(`conv:${conversationId}`).emit('message:new', message);
        io.to('admins').emit('conversation:update', {
          conversationId,
          lastMessageText: preview,
          lastMessageAt: new Date(),
        });

        // Dedicated ping for deposit requests so the admin dashboard can toast + play a sound
        if (resolvedType === 'deposit_card') {
          io.to('admins').emit('admin:notify', {
            conversationId,
            userName: conversation.userName,
            email: conversation.email || null,
            game: meta?.game,
            amount: meta?.amount,
          });
        }

        // Web Push — reaches the admin even if the dashboard tab isn't open/focused
        const pushTitle =
          resolvedType === 'deposit_card'
            ? `💳 Deposit request — ${conversation.userName}`
            : `New message from ${conversation.userName}`;
        const pushBody =
          resolvedType === 'deposit_card'
            ? `$${meta?.amount} via ${meta?.method} for ${meta?.game}`
            : imageUrl
              ? '📷 Sent an image'
              : text;
        notifyAdmins({ title: pushTitle, body: pushBody, url: '/admin', conversationId }).catch(() => {});
      } catch (err) {
        socket.emit('error:message', 'Could not send message');
      }
    });

    socket.on('admin:message', async ({ conversationId, text, imageUrl }) => {
      if (!socket.isAdmin || !conversationId) return;
      try {
        const message = await Message.create({
          conversationId,
          sender: 'admin',
          type: imageUrl ? 'image' : 'text',
          text: text || '',
          imageUrl: imageUrl || '',
        });

        const preview = imageUrl ? '📷 Image' : text;

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessageText: preview,
          lastMessageAt: new Date(),
        });

        io.to(`conv:${conversationId}`).emit('message:new', message);
        io.to('admins').emit('conversation:update', {
          conversationId,
          lastMessageText: preview,
          lastMessageAt: new Date(),
        });
      } catch (err) {
        socket.emit('error:message', 'Could not send message');
      }
    });
  });
}

module.exports = registerChatHandlers;
