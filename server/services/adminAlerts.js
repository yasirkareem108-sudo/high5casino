const Conversation = require('../models/Conversation');
const push = require('./push');
const { runExclusive } = require('./keyedQueue');

// Sum of unread alerts across every conversation — this is the number shown on the admin app icon.
async function totalUnread() {
  const result = await Conversation.aggregate([{ $group: { _id: null, total: { $sum: '$adminUnread' } } }]);
  return result[0]?.total || 0;
}

// A player logged in: count it as an unread alert on their conversation, tell open admin
// dashboards, and push it to admin devices. Accounts that have never opened chat have no
// conversation yet — their first join is announced as a new player instead.
async function recordPlayerLogin(io, user) {
  const existing = await Conversation.findOne({ userId: user._id.toString() }).select('_id');
  if (!existing) return;

  // Same per-conversation queue as chat messages, so counts are announced in the order applied.
  const conversation = await runExclusive(String(existing._id), async () => {
    const updated = await Conversation.findByIdAndUpdate(
      existing._id,
      { $inc: { adminUnread: 1 } },
      { returnDocument: 'after' }
    );
    if (updated) {
      io?.to('admins').emit('conversation:update', {
        conversationId: updated._id,
        adminUnread: updated.adminUnread,
      });
    }
    return updated;
  });
  if (!conversation) return;

  await push.notifyAdmins({
    title: 'Player logged in',
    body: `${user.name} just logged in`,
    url: '/admin',
    conversationId: conversation._id,
    badge: await totalUnread().catch(() => undefined),
  });
}

module.exports = { totalUnread, recordPlayerLogin };
