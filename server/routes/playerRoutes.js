const express = require('express');
const { playerAuth } = require('../middleware/auth');
const { getMe, getMyDeposits } = require('../controllers/playerController');

const router = express.Router();

router.get('/', playerAuth, getMe);
router.get('/deposits', playerAuth, getMyDeposits);

module.exports = router;
