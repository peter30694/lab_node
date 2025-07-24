const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const rootDir = require('../util/path');
const adminController = require('../controllers/admin');
const newsController = require('../controllers/news');
const isAuth = require('../middleware/is-auth');
const isAdmin = require('../middleware/is-admin');
const newsUpload = require('../util/news-upload');
const serviceUpload = require('../util/service-upload');
const productUpload = require('../util/product-upload');
const contactController = require('../controllers/admin/contact');

// Cấu hình multer cho file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const uploadMulter = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file CSV hoặc Excel'), false);
    }
  }
});

const router = express.Router();

// /admin/add-product => GET
router.get('/add-product', isAuth, isAdmin, adminController.getAddProduct);

// /admin/add-product => POST
router.post('/add-product', isAuth, isAdmin, productUpload.single('image'), (err, req, res, next) => {
  if (err) {
    // Lấy lại categories để render form
    const Category = require('../models/category');
    Category.find().then(categories => {
      res.status(400).render('admin/add-product', {
        pageTitle: 'Thêm sản phẩm',
        path: '/admin/add-product',
        editing: false,
        categories,
        product: {
          title: req.body.title || '',
          price: req.body.price || '',
          description: req.body.description || '',
          imageUrl: ''
        },
        errorMessage: err.message,
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
      });
    }).catch(() => {
      res.status(400).send('Lỗi upload file: ' + err.message);
    });
    return;
  }
  next();
}, adminController.postAddProduct);

// /admin/products => GET
router.get('/products', isAuth, isAdmin, adminController.getProducts);

// /admin/edit-product/:productId => GET
router.get('/edit-product/:productId', isAuth, isAdmin, adminController.getEditProduct);

// /admin/edit-product => POST
router.post('/edit-product', isAuth, isAdmin, productUpload.single('image'), (err, req, res, next) => {
  if (err) {
    // Lấy lại categories để render form
    const Category = require('../models/category');
    Category.find().then(categories => {
      res.status(400).render('admin/edit-product', {
        pageTitle: 'Chỉnh sửa sản phẩm',
        path: '/admin/edit-product',
        editing: true,
        categories,
        product: {
          _id: req.body.productId,
          title: req.body.title || '',
          price: req.body.price || '',
          description: req.body.description || '',
          imageUrl: ''
        },
        errorMessage: err.message,
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
      });
    }).catch(() => {
      res.status(400).send('Lỗi upload file: ' + err.message);
    });
    return;
  }
  next();
}, adminController.postEditProduct);

// /admin/delete-product => POST
router.post('/delete-product', isAuth, isAdmin, adminController.postDeleteProduct);

// Route tải xuống hóa đơn PDF
router.get('/download-invoice/:orderId', isAuth, isAdmin, adminController.getDownloadInvoice);

// Route xuất PDF danh sách sản phẩm
router.get('/export-products-pdf', isAuth, isAdmin, adminController.getExportProductsPDF);

// Route xuất Excel danh sách sản phẩm
router.get('/export-products', isAuth, isAdmin, adminController.getExportProducts);

// Routes quản lý đơn hàng
router.get('/orders', isAuth, isAdmin, adminController.getOrders);

// Route xem chi tiết đơn hàng
router.get('/orders/:orderId', isAuth, isAdmin, adminController.getOrderDetail);

// Route cập nhật trạng thái đơn hàng
router.post('/update-order-status', isAuth, isAdmin, adminController.postUpdateOrderStatus);

// Route cập nhật trạng thái đơn hàng theo ID
router.post('/orders/:orderId/update-status', isAuth, isAdmin, adminController.postUpdateOrderStatusById);

// Route cập nhật trạng thái thanh toán
router.post('/update-payment-status', isAuth, isAdmin, adminController.postUpdatePaymentStatus);

// Route cập nhật trạng thái thanh toán theo ID
router.post('/orders/:orderId/update-payment-status', isAuth, isAdmin, adminController.postUpdatePaymentStatusById);

// Route gửi thông báo đơn hàng
// router.post('/orders/:orderId/send-notification', isAuth, isAdmin, adminController.sendOrderNotification);

// Gửi lại hóa đơn cho khách hàng
router.post('/orders/:orderId/resend-invoice', isAuth, isAdmin, adminController.resendInvoice);

// Route in đơn hàng
// router.get('/orders/:orderId/print', isAuth, isAdmin, adminController.printOrder);

// Route quản lý booking
router.get('/bookings', isAuth, isAdmin, adminController.getBookings);
router.post('/bookings/:id/update-status', isAuth, isAdmin, adminController.updateBookingStatus);
router.post('/bookings/:id/approve', isAuth, isAdmin, adminController.approveBooking);
router.post('/bookings/:id/reject', isAuth, isAdmin, adminController.rejectBooking);
router.delete('/bookings/:id', isAuth, isAdmin, adminController.deleteBooking);

// Route tải hóa đơn
router.get('/orders/:orderId/invoice', isAuth, isAdmin, adminController.getDownloadInvoice);

// Route tải hóa đơn theo orderId
router.get('/orders/:orderId/download-invoice', isAuth, isAdmin, adminController.getDownloadInvoiceById);

// Route DELETE /admin/orders/:orderId cho admin xoá đơn hàng.
router.delete('/orders/:orderId', isAuth, isAdmin, adminController.deleteOrder);

// Route GET /admin/dashboard
router.get('/dashboard', isAuth, isAdmin, adminController.getDashboard);

// Route xuất PDF dashboard
router.get('/dashboard/export-pdf', isAuth, isAdmin, adminController.exportDashboardPDF);

// ===== ROUTES QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG =====
// Route GET /accounts
router.get('/accounts', isAuth, isAdmin, adminController.getUsers);

// Route DELETE /accounts/:userId
router.delete('/accounts/:userId', isAuth, isAdmin, adminController.deleteUser);

// Route GET /accounts/create
router.get('/accounts/create', isAuth, isAdmin, adminController.getCreateUser);

// Route POST /accounts/create
router.post('/accounts/create', isAuth, isAdmin, adminController.postCreateUser);

// Route GET /accounts/:userId/edit
router.get('/accounts/:userId/edit', isAuth, isAdmin, adminController.getEditUser);

// Route POST /accounts/:userId/edit
router.post('/accounts/:userId/edit', isAuth, isAdmin, adminController.postEditUser);

// Route POST /accounts/:userId/change-password - Thay đổi mật khẩu
router.post('/accounts/:userId/change-password', isAuth, isAdmin, adminController.postChangeUserPassword);

// Route POST /accounts/:userId/send-welcome-email - Gửi email chào mừng
router.post('/accounts/:userId/send-welcome-email', isAuth, isAdmin, adminController.postSendWelcomeEmail);

// Route POST /accounts/:userId/reset-password - Reset mật khẩu
router.post('/accounts/:userId/reset-password', isAuth, isAdmin, adminController.postResetUserPassword);

// Route POST /accounts/quick-create - Tạo người dùng nhanh
// router.post('/accounts/quick-create', isAuth, isAdmin, adminController.postQuickCreateUser);

// Route POST /accounts/bulk-import - Import người dùng hàng loạt
// router.post('/accounts/bulk-import', isAuth, isAdmin, uploadMulter.single('file'), adminController.postBulkImportUsers);

// Route GET /accounts/statistics - Lấy thống kê người dùng
// router.get('/accounts/statistics', isAuth, isAdmin, adminController.getUserStatistics);

// ===== ROUTES QUẢN LÝ KHO SẢN PHẨM =====
// Đã gộp vào quản lý sản phẩm, xóa các route inventory



// Route thông báo
router.get('/notifications', isAuth, isAdmin, adminController.getNotifications);

// Routes quản lý mã giảm giá
router.get('/coupons', isAuth, isAdmin, adminController.getCoupons);
router.get('/coupons/add', isAuth, isAdmin, adminController.getAddCoupon);
router.post('/coupons/add', isAuth, isAdmin, adminController.postAddCoupon);
router.get('/coupons/:couponId/edit', isAuth, isAdmin, adminController.getEditCoupon);
router.post('/coupons/:couponId/edit', isAuth, isAdmin, adminController.postEditCoupon);
router.delete('/coupons/:couponId', isAuth, isAdmin, adminController.deleteCoupon);

// Routes cho quản lý mã giảm giá
router.get('/coupons/stats', isAuth, isAdmin, adminController.getCouponStats);
router.post('/coupons/generate-code', isAuth, isAdmin, adminController.generateCouponCode);

// Routes quản lý reviews
router.get('/reviews', isAuth, isAdmin, adminController.getReviews);
router.get('/reviews/:reviewId', isAuth, isAdmin, adminController.getReviewDetail);
router.post('/reviews/:reviewId/update-status', isAuth, isAdmin, adminController.updateReviewStatus);
router.post('/reviews/:reviewId/reply', isAuth, isAdmin, adminController.replyToReview);
router.get('/reviews/stats', isAuth, isAdmin, adminController.getReviewStats);
router.delete('/reviews/:reviewId', isAuth, isAdmin, adminController.deleteReview);

// Routes quản lý newsletter
router.get('/newsletter', isAuth, isAdmin, adminController.getNewsletterSubscribers);
router.post('/newsletter/send', isAuth, isAdmin, adminController.sendNewsletter);

// Routes quản lý liên hệ
router.get('/contacts', isAuth, isAdmin, adminController.getContacts);
router.get('/contacts/data', isAuth, isAdmin, adminController.getContactsData);
router.get('/contacts/stats', isAuth, isAdmin, adminController.getContactStats);
router.get('/contacts/:id', isAuth, isAdmin, adminController.getContactDetail);
router.put('/contacts/:id/status', isAuth, isAdmin, adminController.updateContactStatus);
router.post('/contacts/:id/reply', isAuth, isAdmin, contactController.replyToContact);
router.post('/contacts/:id/approve-newsletter', isAuth, isAdmin, adminController.approveNewsletter);
router.post('/contacts/:id/reject-newsletter', isAuth, isAdmin, adminController.rejectNewsletter);
router.delete('/contacts/:id', isAuth, isAdmin, adminController.deleteContact);
router.get('/contacts/export', isAuth, isAdmin, adminController.exportContacts);
router.get('/contacts/:id/data', isAuth, isAdmin, contactController.getContactDetailJson);

// ===== ROUTES QUẢN LÝ DỊCH VỤ =====
router.get('/services', isAuth, isAdmin, adminController.getServices);
router.get('/services/add', isAuth, isAdmin, adminController.getAddService);
router.post('/services/add', isAuth, isAdmin, serviceUpload.single('image'), (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    return res.status(500).send('Lỗi upload file: ' + err.message);
  }
  next();
}, adminController.postAddService);
router.get('/services/:serviceId/edit', isAuth, isAdmin, adminController.getEditService);
router.post('/services/:serviceId/edit', isAuth, isAdmin, serviceUpload.single('image'), (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    return res.status(500).send('Lỗi upload file: ' + err.message);
  }
  next();
}, adminController.postEditService);
router.delete('/services/:serviceId', isAuth, isAdmin, adminController.deleteService);

// ===== ROUTES QUẢN LÝ TIN TỨC =====
router.get('/news', isAuth, isAdmin, (req, res, next) => {
    console.log('🔍 DEBUG: Accessing admin news list route');
    newsController.getAdminNews(req, res, next);
});
router.post('/news/delete', isAuth, isAdmin, newsController.postDeleteNews);

// Routes cụ thể phải đặt trước routes với parameter
router.get('/news/add', isAuth, isAdmin, newsController.getAddNews);
router.post('/news/add', isAuth, isAdmin, newsUpload.single('image'), newsController.postAddNews);

// Routes với parameter đặt sau routes cụ thể
router.get('/news/edit/:newsId', isAuth, isAdmin, (req, res, next) => {
    console.log('🔍 DEBUG: Accessing edit news route with ID:', req.params.newsId);
    newsController.getEditNews(req, res, next);
});

// Route xem chi tiết tin tức (admin)
router.get('/news/detail/:newsId', isAuth, isAdmin, newsController.getAdminNewsDetail);
router.post('/news/edit', isAuth, isAdmin, newsUpload.single('image'), newsController.postEditNews);

// Routes cho quản lý contact và news
router.get('/contact-news-stats', adminController.getContactAndNewsStats);
router.get('/export-contacts', adminController.exportContacts);

module.exports = router;

