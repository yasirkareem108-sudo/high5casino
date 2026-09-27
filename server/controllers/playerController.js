const User = require('../models/User');
const Deposit = require('../models/Deposit');

// GET /api/me — validates the stored token and returns the account profile.
async function getMe(req, res) {
  const user = await User.findById(req.player.userId);
  if (!user) return res.status(401).json({ message: 'Account no longer exists' });
  res.json({
    user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
  });
}

// GET /api/me/deposits — this player's deposit requests, newest first.
async function getMyDeposits(req, res) {
  const deposits = await Deposit.find({ user: req.player.userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('game method amount status createdAt decidedAt');
  res.json({ deposits });
}

module.exports = { getMe, getMyDeposits };
