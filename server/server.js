const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const authRoutes = require('./routes/authRoutes');
const pushRoutes = require('./routes/pushRoutes');
const playerRoutes = require('./routes/playerRoutes');
const registerChatHandlers = require('./socket/chatSocket');

dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || '*';

// Middlewares
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Serve uploaded chat images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Chat / deposit-inbox REST routes
app.use('/api', chatRoutes);

// Player auth (register/login)
app.use('/api/auth', authRoutes);

// Logged-in player's own profile + deposit history
app.use('/api/me', playerRoutes);

// Web Push (VAPID) subscription management
app.use('/api/push', pushRoutes);

// Real-time Socket.io
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

registerChatHandlers(io);

io.on('connection', (socket) => {
  console.log(`⚡ User Connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log('🔥 User Disconnected', socket.id);
  });
});

// Test API Route
app.get('/', (req, res) => {
  res.send('🎰 High 5 Casino API is running smoothly!');
});

// Lightweight keep-alive target for uptime monitors — no DB access, so it stays cheap.
// (Express answers HEAD for GET routes automatically.)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// JSON error handler (Express 5 forwards async route rejections here)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: 'That email is already registered' });
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 High 5 Casino Server running on port ${PORT}`);
});