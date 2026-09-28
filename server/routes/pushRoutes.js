const express = require('express');
const { adminAuth } = require('../middleware/auth');
const { getPublicKey, subscribe, unsubscribe, status, test } = require('../controllers/pushController');

const router = express.Router();

router.get('/public-key', getPublicKey);
router.post('/subscribe', adminAuth, subscribe);
router.post('/unsubscribe', adminAuth, unsubscribe);
router.post('/status', adminAuth, status);
router.post('/test', adminAuth, test);

module.exports = router;
