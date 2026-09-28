const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const push = require('../services/push');
const { totalUnread } = require('../services/adminAlerts');
const { runExclusive } = require('../services/keyedQueue');

const OBJECT_ID = /^[a-f0-9]{24}$/;
const UPLOAD_URL = /^\/uploads\/[\w.-]+$/;
const MAX_TEXT = 2000;

// One conversation per player account, keyed by the account's permanent Mongo _id.
// Older threads were keyed by a random per-browser id; if one of those carries the
// same email as this account we adopt it, so pre-account history isn't lost.
async function getOrCreateConversation(user) {
  const userId = user._id.toString();

  let conversation = await Conversation.findOne({ userId });
  if (conversation) {
    const changed = conversation.userName !== user.name || conversation.email !== user.email;
    if (changed) {
      conversation.userName = user.name;
      conversation.email = user.email;
      await conversation.save();
    }
    return { conversation, created: false, changed };
  }

  conversation = await Conversation.findOneAndUpdate(
    { email: user.email, userId: { $not: OBJECT_ID } },
    { $set: { userId, userName: user.name } },
    { sort: { lastMessageAt: -1 }, returnDocument: 'after' }
  );
  if (conversation) return { conversation, created: false, changed: true };

  try {
    // A brand-new account opening chat for the first time counts as one unread alert ("new player").
    conversation = await Conversation.create({ userId, userName: user.name, email: user.email, adminUnread: 1 });
    return { conversation, created: true, changed: false };
  } catch (err) {
    // Two tabs joining at once: the unique index on userId means only one create wins.
    if (err.code === 11000) {
      return { conversation: await Conversation.findOne({ userId }), created: false, changed: false };
    }
    throw err;
  }
}

function registerChatHandlers(io) {
  // Persists a message, bumps the conversation preview, and fans it out.
  // Messages from a player also add one to the admin's unread count for that conversation.
  // Serialized per conversation so the unread counts we announce arrive in the order they were applied.
  function publish(conversationId, fields, preview) {
    return runExclusive(String(conversationId), async () => {
      const message = await Message.create({ conversationId, ...fields });
      const lastMessageAt = new Date();
      const lastMessageType = fields.type || 'text';
      const lastMessageSender = fields.sender;
      const update = { $set: { lastMessageText: preview, lastMessageAt, lastMessageType, lastMessageSender } };
      if (fields.sender === 'user') update.$inc = { adminUnread: 1 };
      const conversation = await Conversation.findByIdAndUpdate(conversationId, update, { returnDocument: 'after' });

      io.to(`conv:${conversationId}`).emit('message:new', message);
      io.to('admins').emit('conversation:update', {
        conversationId,
        lastMessageText: preview,
        lastMessageAt,
        lastMessageType,
        lastMessageSender,
        adminUnread: conversation?.adminUnread ?? 0,
      });
      return message;
    });
  }

  io.on('connection', (socket) => {
    socket.isAdmin = false;

    // ---- Admin ----------------------------------------------------------
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

    socket.on('admin:join_conversation', (conversationId) => {
      if (!socket.isAdmin || !OBJECT_ID.test(String(conversationId))) return;
      socket.join(`conv:${conversationId}`);
    });

    // The admin opened / is looking at this conversation: clear its unread alerts.
    // Broadcast to all admins so other tabs and devices drop their badge too.
    socket.on('admin:read', async (conversationId) => {
      if (!socket.isAdmin || !OBJECT_ID.test(String(conversationId))) return;
      try {
        await runExclusive(String(conversationId), async () => {
          const conversation = await Conversation.findByIdAndUpdate(
            conversationId,
            { $set: { adminUnread: 0 } },
            { returnDocument: 'after' }
          );
          if (conversation) io.to('admins').emit('conversation:update', { conversationId, adminUnread: 0 });
        });
      } catch (err) {
        // non-critical — the next unread update will resync
      }
    });

    socket.on('admin:message', async ({ conversationId, text, imageUrl } = {}) => {
      if (!socket.isAdmin || !OBJECT_ID.test(String(conversationId))) return;
      const cleanText = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : '';
      const cleanImage = typeof imageUrl === 'string' && UPLOAD_URL.test(imageUrl) ? imageUrl : '';
      if (!cleanText && !cleanImage) return;
      try {
        await publish(
          conversationId,
          { sender: 'admin', type: cleanImage ? 'image' : 'text', text: cleanText, imageUrl: cleanImage },
          cleanImage ? '📷 Image' : cleanText
        );
      } catch (err) {
        socket.emit('error:message', 'Could not send message');
      }
    });

    // Approve/reject a deposit: updates the Deposit record, the card in the chat,
    // and posts the admin's reply. findOneAndUpdate on status:'pending' makes a
    // double-click (or two admins) decide it exactly once.
    socket.on('admin:deposit_decision', async ({ depositId, decision } = {}) => {
      if (!socket.isAdmin || !OBJECT_ID.test(String(depositId))) return;
      if (!['approved', 'rejected'].includes(decision)) return;
      try {
        const deposit = await Deposit.findOneAndUpdate(
          { _id: depositId, status: 'pending' },
          { status: decision, decidedAt: new Date() },
          { returnDocument: 'after' }
        );
        if (!deposit) {
          socket.emit('error:message', 'That deposit was already decided');
          return;
        }

        await Message.updateOne({ _id: deposit.messageId }, { $set: { 'meta.status': decision } });
        io.to(`conv:${deposit.conversationId}`)
          .to('admins')
          .emit('deposit:updated', {
            depositId: deposit._id,
            messageId: deposit.messageId,
            conversationId: deposit.conversationId,
            status: decision,
          });

        const amount = deposit.amount.toFixed(2);
        const reply =
          decision === 'approved'
            ? `✅ Your $${amount} deposit for ${deposit.game} has been approved and credited. Enjoy!`
            : `❌ Your deposit request for ${deposit.game} could not be verified. Please reach out here with more details.`;
        await publish(deposit.conversationId, { sender: 'admin', type: 'text', text: reply }, reply);
      } catch (err) {
        socket.emit('error:message', 'Could not update deposit');
      }
    });

    // ---- Player ---------------------------------------------------------
    // Identity comes from the verified JWT, never from anything the client claims.
    socket.on('user:join', async ({ token } = {}) => {
      let user = null;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'player') throw new Error('Not a player token');
        user = await User.findById(decoded.userId);
      } catch (err) {
        user = null;
      }
      if (!user) {
        socket.emit('user:auth_error', 'Please log in again');
        return;
      }

      try {
        const { conversation, created, changed } = await getOrCreateConversation(user);
        socket.playerUserId = user._id.toString();
        socket.playerConversationId = conversation._id.toString();
        socket.join(`conv:${conversation._id}`);

        if (created) {
          io.to('admins').emit('conversation:new', conversation);
          push
            .notifyAdmins({
              title: 'New player',
              body: `${conversation.userName} just signed up`,
              url: '/admin',
              conversationId: conversation._id,
              badge: await totalUnread().catch(() => undefined),
            })
            .catch(() => {});
        } else if (changed) {
          io.to('admins').emit('conversation:update', {
            conversationId: conversation._id,
            userName: conversation.userName,
            email: conversation.email,
          });
        }

        const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
        socket.emit('user:joined', { conversationId: conversation._id, messages });
      } catch (err) {
        socket.emit('error:message', 'Could not load your conversation');
      }
    });

    socket.on('user:message', async ({ text, imageUrl, meta, type } = {}) => {
      const conversationId = socket.playerConversationId;
      if (!conversationId) return;

      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        if (type === 'deposit_card') {
          const amount = Number(meta?.amount);
          const game = typeof meta?.game === 'string' ? meta.game.trim().slice(0, 60) : '';
          const method = typeof meta?.method === 'string' ? meta.method.trim().slice(0, 40) : '';
          if (!game || !method || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
            socket.emit('error:message', 'Invalid deposit request');
            return;
          }

          const deposit = await Deposit.create({
            user: socket.playerUserId,
            conversationId,
            game,
            method,
            amount,
          });
          const message = await publish(
            conversationId,
            {
              sender: 'user',
              type: 'deposit_card',
              meta: {
                game,
                method,
                amount,
                name: conversation.userName,
                email: conversation.email || null,
                depositId: deposit._id.toString(),
                status: 'pending',
              },
            },
            `💳 Deposit request: $${amount}`
          );
          deposit.messageId = message._id;
          await deposit.save();

          io.to('admins').emit('admin:notify', {
            conversationId,
            userName: conversation.userName,
            email: conversation.email || null,
            game,
            amount,
          });
          push
            .notifyAdmins({
              title: `💳 Deposit request — ${conversation.userName}`,
              body: `$${amount} via ${method} for ${game}`,
              url: '/admin',
              conversationId,
              badge: await totalUnread().catch(() => undefined),
            })
            .catch(() => {});
          return;
        }

        const cleanText = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : '';
        const cleanImage = typeof imageUrl === 'string' && UPLOAD_URL.test(imageUrl) ? imageUrl : '';
        if (!cleanText && !cleanImage) return;

        await publish(
          conversationId,
          { sender: 'user', type: cleanImage ? 'image' : 'text', text: cleanText, imageUrl: cleanImage },
          cleanImage ? '📷 Image' : cleanText
        );
        push
          .notifyAdmins({
            title: `New message from ${conversation.userName}`,
            body: cleanImage ? '📷 Sent an image' : cleanText,
            url: '/admin',
            conversationId,
            badge: await totalUnread().catch(() => undefined),
          })
          .catch(() => {});
      } catch (err) {
        socket.emit('error:message', 'Could not send message');
      }
    });
  });
}

module.exports = registerChatHandlers;
