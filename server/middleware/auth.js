const jwt = require('jsonwebtoken');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireRole(role) {
  return (req, res, next) => {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== role) throw new Error(`Not a ${role} token`);
      req.auth = decoded;
      if (role === 'admin') req.admin = decoded;
      if (role === 'player') req.player = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

const adminAuth = requireRole('admin');
const playerAuth = requireRole('player');

module.exports = { adminAuth, playerAuth };
