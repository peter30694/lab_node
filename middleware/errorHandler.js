const { AppError, ValidationError, AuthenticationError, NotFoundError, DatabaseError } = require('../util/errors');
const path = require('path');
const fs = require('fs');

// Middleware xử lý 404 - Not Found
const notFoundHandler = (req, res, next) => {
    if (req.path.startsWith('/images/')) {
        const defaultNames = [
            'default-product.jpg',
            'default-product.png',
            'default-product.jpeg',
            'default-product.webp'
        ];
        for (const name of defaultNames) {
            if (req.path === `/images/${name}`) {
                return res.status(404).end();
            }
            const defaultPath = path.join(__dirname, '..', 'public', 'images', name);
            if (fs.existsSync(defaultPath)) {
                return res.sendFile(defaultPath);
            }
        }
        return res.status(404).end();
    }
    
    // Don't create 404 errors for static files
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/fonts/')) {
        return res.status(404).end();
    }
    
    const error = new NotFoundError(`Không tìm thấy trang: ${req.originalUrl}`);
    next(error);
};

// Middleware xử lý lỗi chung
const errorHandler = (error, req, res, next) => {
    let err = { ...error };
    err.message = error.message;

    // Don't log 404 errors for missing product images
    const isProductImage404 = req.path.startsWith('/images/products/') && error.statusCode === 404;
    
    if (!isProductImage404) {
        // Log lỗi để debug
        console.error('Error:', {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }

    // Xử lý các loại lỗi MongoDB
    if (error.name === 'CastError') {
        const message = 'ID không hợp lệ';
        err = new ValidationError(message);
    }

    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const message = `${field} đã tồn tại`;
        err = new ValidationError(message);
    }

    if (error.name === 'ValidationError') {
        const message = Object.values(error.errors).map(val => val.message).join(', ');
        err = new ValidationError(message);
    }

    // Xử lý lỗi JWT
    if (error.name === 'JsonWebTokenError') {
        const message = 'Token không hợp lệ';
        err = new AuthenticationError(message);
    }

    if (error.name === 'TokenExpiredError') {
        const message = 'Token đã hết hạn';
        err = new AuthenticationError(message);
    }

    // Xác định status code và message
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Lỗi máy chủ nội bộ';

    // Trong môi trường production, không hiển thị chi tiết lỗi
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        message = 'Đã xảy ra lỗi, vui lòng thử lại sau';
    }

    // Xử lý response dựa trên loại request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        // API request - trả về JSON
        return res.status(statusCode).json({
            success: false,
            error: {
                message,
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            }
        });
    }

    // Web request - render error page
    res.status(statusCode);
    
    // Render trang lỗi phù hợp
    if (statusCode === 404) {
        return res.render('error/404', {
            pageTitle: 'Không tìm thấy trang',
            path: '/404',
            message: message,
            url: req.originalUrl,
            isAdmin: req.session?.user && req.session.user.role === 'admin',
            isAuthenticated: !!req.session?.user,
            user: req.session?.user || null,
            cartCount: req.session?.cart ? req.session.cart.length : 0,
            categories: res.locals.categories || []
        });
    }

    if (statusCode === 403) {
        return res.render('error/403', {
            pageTitle: 'Không có quyền truy cập',
            path: '/403',
            message: message,
            isAdmin: req.session?.user && req.session.user.role === 'admin',
            isAuthenticated: !!req.session?.user,
            user: req.session?.user || null,
            cartCount: req.session?.cart ? req.session.cart.length : 0,
            categories: res.locals.categories || []
        });
    }

    if (statusCode === 401) {
        return res.render('error/401', {
            pageTitle: 'Chưa đăng nhập',
            path: '/401',
            message: message,
            isAdmin: req.session?.user && req.session.user.role === 'admin',
            isAuthenticated: !!req.session?.user,
            user: req.session?.user || null,
            cartCount: req.session?.cart ? req.session.cart.length : 0,
            categories: res.locals.categories || []
        });
    }

    // Lỗi 500 hoặc các lỗi khác
    res.render('error/500', {
        pageTitle: 'Lỗi máy chủ',
        path: '/500',
        message: message,
        isAdmin: req.session?.user && req.session.user.role === 'admin',
        isAuthenticated: !!req.session?.user,
        user: req.session?.user || null,
        cartCount: req.session?.cart ? req.session.cart.length : 0,
        categories: res.locals.categories || [],
        ...(process.env.NODE_ENV === 'development' && { 
            error: error,
            stack: error.stack 
        })
    });
};

// Middleware bắt lỗi async
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Middleware validation lỗi
const validationErrorHandler = (req, res, next) => {
    const errors = req.validationErrors();
    if (errors) {
        const message = errors.map(error => error.msg).join(', ');
        return next(new ValidationError(message));
    }
    next();
};

// Middleware rate limiting error
const rateLimitHandler = (req, res, next) => {
    const error = new AppError('Quá nhiều yêu cầu, vui lòng thử lại sau', 429);
    next(error);
};

// Middleware để xử lý logout notifications
const handleLogoutNotifications = (req, res, next) => {
    // Thêm logout notifications vào locals
    res.locals.logoutSuccess = req.query.logout === 'success';
    res.locals.logoutError = req.query.logout === 'error';
    next();
};

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler,
    validationErrorHandler,
    rateLimitHandler,
    handleLogoutNotifications
};