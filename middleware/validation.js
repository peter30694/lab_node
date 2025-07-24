const { body, validationResult } = require('express-validator');

// Middleware để xử lý kết quả validation
const handleValidationErrors = (req, res, next) => {
    console.log('=== [VALIDATE] handleValidationErrors called ===');
    console.log('=== [VALIDATE] Request URL:', req.originalUrl);
    console.log('=== [VALIDATE] Request method:', req.method);
    console.log('=== [VALIDATE] Request body:', req.body);
    
    const errors = validationResult(req);
    console.log('=== [VALIDATE] Validation errors:', errors.array());
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        console.log('=== [VALIDATE] Lỗi validation:', errorMessages);
        // Nếu là đăng ký user từ form web (không phải API/AJAX)
        if (req.originalUrl === '/auth/signup' && req.method === 'POST' && !(req.xhr || req.headers.accept?.includes('json'))) {
            console.log('=== [VALIDATE] Render lại view với lỗi');
            // Render lại view với thông báo lỗi
            return res.status(400).render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                error: errorMessages.join(', '),
                isAuthenticated: false,
                isAdmin: false,
                user: null
            });
        }
        // Mặc định trả về JSON cho API/AJAX
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: errorMessages
        });
    }
    console.log('=== [VALIDATE] Validation thành công, chuyển tiếp');
    next();
};

// Validation rules cho product
const validateProduct = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Tên sản phẩm phải từ 3-100 ký tự'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('Giá sản phẩm phải là số dương'),
    body('description')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Mô tả sản phẩm phải từ 10-1000 ký tự'),
    body('category')
        .trim()
        .notEmpty()
        .withMessage('Danh mục sản phẩm không được để trống'),
    handleValidationErrors
];

// Validation rules cho user registration với kiểm tra mật khẩu mạnh
const validateUserRegistration = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Tên phải từ 2-50 ký tự'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
        .matches(/\d/)
        .withMessage('Mật khẩu phải chứa ít nhất 1 số'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Mật khẩu xác nhận không khớp');
            }
            return true;
        }),
    handleValidationErrors
];

// Validation rules cho user login
const validateUserLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    body('password')
        .notEmpty()
        .withMessage('Mật khẩu không được để trống'),
    handleValidationErrors
];

// Validation rules cho password change
const validatePasswordChange = [
    body('oldPassword')
        .notEmpty()
        .withMessage('Mật khẩu cũ không được để trống'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
        .matches(/\d/)
        .withMessage('Mật khẩu mới phải chứa ít nhất 1 số'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Mật khẩu xác nhận không khớp');
            }
            return true;
        }),
    handleValidationErrors
];

// Validation rules cho shipping info
const validateShippingInfo = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Tên người nhận phải từ 2-50 ký tự'),
    body('phone')
        .matches(/^[0-9]{10,11}$/)
        .withMessage('Số điện thoại phải có 10-11 chữ số'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    body('address')
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage('Địa chỉ phải từ 10-200 ký tự'),
    handleValidationErrors
];

// Validation rules cho order
const validateOrder = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Đơn hàng phải có ít nhất 1 sản phẩm'),
    body('items.*.productId')
        .isMongoId()
        .withMessage('ID sản phẩm không hợp lệ'),
    body('items.*.quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Số lượng phải từ 1-100'),
    body('totalPrice')
        .isFloat({ min: 0 })
        .withMessage('Tổng tiền phải là số dương'),
    body('paymentMethod')
        .isIn(['cod', 'bank', 'ewallet', 'credit'])
        .withMessage('Phương thức thanh toán không hợp lệ'),
    handleValidationErrors
];

// Validation rules cho ObjectId
const validateObjectId = (paramName) => [
    body(paramName)
        .isMongoId()
        .withMessage(`${paramName} không hợp lệ`),
    handleValidationErrors
];

// Validation rules cho review
const validateReview = [
    body('productId')
        .optional()
        .isMongoId()
        .withMessage('Product ID không hợp lệ'),
    body('serviceId')
        .optional()
        .isMongoId()
        .withMessage('Service ID không hợp lệ'),
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating phải từ 1-5 sao'),
    body('comment')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Nội dung đánh giá phải từ 10-1000 ký tự')
        .matches(/^[^<>]*$/)
        .withMessage('Nội dung đánh giá không được chứa ký tự đặc biệt'),
    handleValidationErrors
];

// Validation rules cho admin reply
const validateAdminReply = [
    body('adminReply')
        .trim()
        .isLength({ min: 5, max: 500 })
        .withMessage('Phản hồi phải từ 5-500 ký tự')
        .matches(/^[^<>]*$/)
        .withMessage('Phản hồi không được chứa ký tự đặc biệt'),
    handleValidationErrors
];

// Validation rules cho coupon
const validateCoupon = [
    body('code')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Mã giảm giá phải từ 3-20 ký tự')
        .matches(/^[A-Z0-9-]+$/)
        .withMessage('Mã giảm giá chỉ được chứa chữ cái, số và dấu gạch ngang'),
    body('discountType')
        .isIn(['percentage', 'fixed'])
        .withMessage('Loại giảm giá không hợp lệ'),
    body('discountValue')
        .isFloat({ min: 0.01 })
        .withMessage('Giá trị giảm phải là số dương'),
    body('minOrderValue')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Giá trị đơn hàng tối thiểu phải là số không âm'),
    body('maxDiscount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Giảm giá tối đa phải là số không âm'),
    body('usageLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Số lần sử dụng tối đa phải là số nguyên dương'),
    body('startDate')
        .isISO8601()
        .withMessage('Ngày bắt đầu không hợp lệ'),
    body('endDate')
        .isISO8601()
        .withMessage('Ngày kết thúc không hợp lệ')
        .custom((endDate, { req }) => {
            const startDate = new Date(req.body.startDate);
            const endDateObj = new Date(endDate);
            if (endDateObj <= startDate) {
                throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
            }
            return true;
        }),
    handleValidationErrors
];

// Validation rules cho contact
const validateContact = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Tên phải từ 2-50 ký tự')
        .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
        .withMessage('Tên chỉ được chứa chữ cái và khoảng trắng'),
    body('phone')
        .optional()
        .matches(/^[0-9]{10,11}$/)
        .withMessage('Số điện thoại phải có 10-11 chữ số'),
    body('subject')
        .optional()
        .trim()
        .isLength({ min: 5, max: 100 })
        .withMessage('Chủ đề phải từ 5-100 ký tự')
        .matches(/^[a-zA-ZÀ-ỹ0-9\s\-_.,!?()]+$/)
        .withMessage('Chủ đề chứa ký tự không hợp lệ'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Nội dung tin nhắn phải từ 10-2000 ký tự')
        .matches(/^[^<>]*$/)
        .withMessage('Nội dung không được chứa ký tự đặc biệt'),
    handleValidationErrors
];

// Validation rules cho newsletter subscription
const validateNewsletter = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    handleValidationErrors
];

// Validation rules cho news
const validateNews = [
    body('title')
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Tiêu đề phải từ 5-200 ký tự')
        .matches(/^[^<>]*$/)
        .withMessage('Tiêu đề không được chứa ký tự đặc biệt'),
    body('content')
        .trim()
        .isLength({ min: 10, max: 10000 })
        .withMessage('Nội dung phải từ 10-10000 ký tự'),
    body('category')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Danh mục phải từ 2-50 ký tự'),
    body('author')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Tác giả phải từ 2-50 ký tự'),
    body('status')
        .optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Trạng thái không hợp lệ'),
    handleValidationErrors
];

// Sanitize input để tránh XSS
const sanitizeInput = [
    body('*').escape().trim()
];

module.exports = {
    handleValidationErrors,
    validateProduct,
    validateUserRegistration,
    validateUserLogin,
    validatePasswordChange,
    validateShippingInfo,
    validateOrder,
    validateObjectId,
    validateReview,
    validateAdminReply,
    validateCoupon,
    validateContact,
    validateNewsletter,
    validateNews,
    sanitizeInput
};