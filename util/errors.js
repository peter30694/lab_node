// Custom Error Classes
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Dữ liệu không hợp lệ') {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Không có quyền truy cập') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Không đủ quyền thực hiện') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Không tìm thấy tài nguyên') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Lỗi cơ sở dữ liệu') {
        super(message, 500);
        this.name = 'DatabaseError';
    }
}

class PaymentError extends AppError {
    constructor(message = 'Lỗi thanh toán') {
        super(message, 402);
        this.name = 'PaymentError';
    }
}

class EmailError extends AppError {
    constructor(message = 'Lỗi gửi email') {
        super(message, 500);
        this.name = 'EmailError';
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error('🚨 Error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // MongoDB CastError
    if (err.name === 'CastError') {
        const message = 'ID không hợp lệ';
        error = new ValidationError(message);
    }

    // MongoDB Duplicate Key Error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} đã tồn tại`;
        error = new ValidationError(message);
    }

    // MongoDB Validation Error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        const message = errors.join(', ');
        error = new ValidationError(message);
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Token không hợp lệ';
        error = new AuthenticationError(message);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token đã hết hạn';
        error = new AuthenticationError(message);
    }

    // Send error response
    res.status(error.statusCode || 500).json({
        success: false,
        error: {
            message: error.message || 'Lỗi máy chủ nội bộ',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

// Async error handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Không tìm thấy route ${req.originalUrl}`);
    next(error);
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    DatabaseError,
    PaymentError,
    EmailError,
    errorHandler,
    asyncHandler,
    notFoundHandler
};