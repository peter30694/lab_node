const express = require('express');
const vnpayController = require('../controllers/vnpay');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// Tạo URL thanh toán VNPay
router.post('/create-payment', isAuth, vnpayController.createPayment);

// Route tương thích với frontend cũ
router.get('/create_payment_url', isAuth, vnpayController.createPaymentUrl);

// Xử lý kết quả trả về từ VNPay
router.get('/return', vnpayController.vnpayReturn);

// Xử lý IPN từ VNPay
router.get('/ipn', vnpayController.vnpayIPN);

module.exports = router;