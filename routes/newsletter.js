const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletter');

// Đăng ký nhận tin tức
router.post('/subscribe', newsletterController.subscribe);

// Hủy đăng ký nhận tin tức
router.get('/unsubscribe', newsletterController.unsubscribe);

// Lấy số lượng subscriber
router.get('/subscriber-count', newsletterController.getSubscriberCount);

module.exports = router; 