const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/services');
const isAuth = require('../middleware/is-auth');

// GET /services - Danh sách dịch vụ
router.get('/', servicesController.getServices);

// GET /services/:id - Chi tiết dịch vụ
router.get('/:id', servicesController.getServiceDetail);

// GET /services/book/:id - Form đặt lịch dịch vụ
router.get('/book/:id', isAuth, servicesController.getBookService);

// POST /services/book/:id - Xử lý đặt lịch dịch vụ
router.post('/book/:id', isAuth, servicesController.postBookService);

// GET /services/:id/available-slots - Lấy slot thời gian khả dụng
router.get('/:id/available-slots', servicesController.getAvailableTimeSlots);

// GET /my-bookings - Lịch đặt của user

// GET /services/category/:category - Dịch vụ theo danh mục
router.get('/category/:category', servicesController.getServicesByCategory);

// POST /services/check-booking-conflict - Kiểm tra trùng giờ đặt dịch vụ
router.post('/check-booking-conflict', servicesController.checkBookingConflict);

module.exports = router;