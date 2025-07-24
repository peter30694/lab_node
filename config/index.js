require('dotenv').config();

// Cấu hình môi trường
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Cấu hình database
const database = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shop',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
        bufferCommands: false
    }
};

// Cấu hình server
const server = {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    }
};

// Cấu hình session
const session = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 1 day
        secure: isProduction, // HTTPS only in production
        httpOnly: true,
        sameSite: 'strict'
    },
    name: 'sessionId'
};

// Cấu hình email
const email = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@itc-school.com'
};

// Cấu hình JWT
const jwt = {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

// Cấu hình upload file
const upload = {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: process.env.UPLOAD_DIR || 'public/uploads',
    tempDir: process.env.TEMP_DIR || 'temp'
};

// Cấu hình VNPay
const vnpay = {
    tmnCode: process.env.VNP_TMN_CODE,
    secretKey: process.env.VNP_SECRET_KEY,
    url: process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNP_RETURN_URL || 'http://localhost:3000/vnpay/return',
    ipnUrl: process.env.VNP_IPN_URL || 'http://localhost:3000/vnpay/ipn'
};

// Cấu hình rate limiting
const rateLimit = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.',
    standardHeaders: true,
    legacyHeaders: false
};

// Cấu hình security
const security = {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 6, // Đổi về 6 ký tự
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutTime: parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000, // 30 minutes
    csrfSecret: process.env.CSRF_SECRET || 'csrf-secret-change-in-production'
};

// Cấu hình logging
const logging = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 7,
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
};

// Cấu hình cache
const cache = {
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600, // 10 minutes
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000
};

// Cấu hình pagination
const pagination = {
    defaultLimit: parseInt(process.env.DEFAULT_LIMIT) || 10,
    maxLimit: parseInt(process.env.MAX_LIMIT) || 100
};

// Cấu hình validation
const validation = {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phoneRegex: /^[0-9]{10,11}$/,
    passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/
};

// Cấu hình API
const api = {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000 // 30 seconds
};

// Kiểm tra cấu hình bắt buộc
const requiredEnvVars = [
    'MONGODB_URI',
    'SESSION_SECRET'
];

if (isProduction) {
    requiredEnvVars.push(
        'JWT_SECRET',
        'EMAIL_USER',
        'EMAIL_PASS',
        'VNP_TMN_CODE',
        'VNP_SECRET_KEY'
    );
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    if (isProduction) {
        process.exit(1);
    }
}

// Export cấu hình
module.exports = {
    NODE_ENV,
    isDevelopment,
    isProduction,
    isTest,
    database,
    server,
    session,
    email,
    jwt,
    upload,
    vnpay,
    rateLimit,
    security,
    logging,
    cache,
    pagination,
    validation,
    api
};

// Log cấu hình hiện tại (chỉ trong development)
if (isDevelopment) {
    console.log('📋 Configuration loaded:', {
        environment: NODE_ENV,
        port: server.port,
        database: database.uri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
        logLevel: logging.level
    });
}