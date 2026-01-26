const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendMessage, getMessages, deleteMessage, updateMessage } = require('../controllers/messageController');

router.post('/', protect, sendMessage);
router.get('/', protect, getMessages);
router.delete('/:id', protect, deleteMessage);
router.put('/:id', protect, updateMessage);

module.exports = router;
