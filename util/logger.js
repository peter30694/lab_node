const fs = require('fs');
const path = require('path');

// Tạo thư mục logs nếu chưa tồn tại
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Định dạng thời gian
const formatTime = () => {
    return new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// Định dạng log message
const formatMessage = (level, message, meta = {}) => {
    const timestamp = formatTime();
    const metaStr = Object.keys(meta).length > 0 ? ` | Meta: ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
};

// Ghi log vào file
const writeToFile = (filename, message) => {
    const filePath = path.join(logsDir, filename);
    fs.appendFileSync(filePath, message, 'utf8');
};

// Xóa log cũ (giữ lại 7 ngày)
const cleanOldLogs = () => {
    const files = fs.readdirSync(logsDir);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            console.log(`Đã xóa log cũ: ${file}`);
        }
    });
};

// Tạo tên file log theo ngày
const getLogFileName = (type = 'app') => {
    const today = new Date().toISOString().split('T')[0];
    return `${type}-${today}.log`;
};

class Logger {
    constructor() {
        // Chạy cleanup mỗi ngày
        setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);
    }
    
    // Log thông tin chung
    info(message, meta = {}) {
        const logMessage = formatMessage('info', message, meta);
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`ℹ️  ${message}`, meta);
        }
        
        writeToFile(getLogFileName('app'), logMessage);
    }
    
    // Log lỗi
    error(message, error = null, meta = {}) {
        const errorMeta = {
            ...meta,
            ...(error && {
                stack: error.stack,
                name: error.name,
                message: error.message
            })
        };
        
        const logMessage = formatMessage('error', message, errorMeta);
        
        console.error(`🚨 ${message}`, error || '', meta);
        
        writeToFile(getLogFileName('error'), logMessage);
        writeToFile(getLogFileName('app'), logMessage);
    }
    
    // Log cảnh báo
    warn(message, meta = {}) {
        const logMessage = formatMessage('warn', message, meta);
        
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`⚠️  ${message}`, meta);
        }
        
        writeToFile(getLogFileName('app'), logMessage);
    }
    
    // Log debug (chỉ trong development)
    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            const logMessage = formatMessage('debug', message, meta);
            console.log(`🐛 ${message}`, meta);
            writeToFile(getLogFileName('debug'), logMessage);
        }
    }
    
    // Log request HTTP
    request(req, res, responseTime) {
        const meta = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userId: req.user ? req.user._id : null
        };
        
        const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
        
        if (res.statusCode >= 400) {
            this.warn(message, meta);
        } else {
            this.info(message, meta);
        }
        
        writeToFile(getLogFileName('access'), formatMessage('access', message, meta));
    }
    
    // Log database operations
    database(operation, collection, meta = {}) {
        const message = `Database ${operation} on ${collection}`;
        const logMessage = formatMessage('database', message, meta);
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`🗄️  ${message}`, meta);
        }
        
        writeToFile(getLogFileName('database'), logMessage);
    }
    
    // Log security events
    security(event, meta = {}) {
        const message = `Security event: ${event}`;
        const logMessage = formatMessage('security', message, meta);
        
        console.warn(`🔒 ${message}`, meta);
        
        writeToFile(getLogFileName('security'), logMessage);
        writeToFile(getLogFileName('app'), logMessage);
    }
    
    // Log performance
    performance(operation, duration, meta = {}) {
        const message = `Performance: ${operation} took ${duration}ms`;
        const performanceMeta = { ...meta, duration, operation };
        
        if (duration > 1000) {
            this.warn(message, performanceMeta);
        } else {
            this.debug(message, performanceMeta);
        }
        
        writeToFile(getLogFileName('performance'), formatMessage('performance', message, performanceMeta));
    }
}

// Middleware để log requests
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end để capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        logger.request(req, res, responseTime);
        originalEnd.apply(this, args);
    };
    
    next();
};

// Tạo instance logger
const logger = new Logger();

// Export
module.exports = {
    logger,
    requestLogger,
    cleanOldLogs
};