const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { adminAuth } = require('../middleware/auth');
const {
  adminLogin,
  listConversations,
  getMessages,
  uploadImage,
} = require('../controllers/chatController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Chat image uploads (used by both the user widget and the admin dashboard)
router.post('/upload', upload.single('file'), uploadImage);

// Admin auth + conversation inbox
router.post('/admin/login', adminLogin);
router.get('/conversations', adminAuth, listConversations);
router.get('/conversations/:id/messages', adminAuth, getMessages);

module.exports = router;
