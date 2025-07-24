require('dotenv').config();
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
const flash = require('connect-flash');
// const fileUpload = require('express-fileupload'); // Tắt hoàn toàn express-fileupload
// Bỏ comment dòng này để kích hoạt csrf
const csrf = require('csurf');

console.log('=== [APP] Starting server initialization ===');

// Giữ lại phần cấu hình csrf nhưng di chuyển nó xuống sau phần cấu hình session
// const csrfProtection = csrf({ cookie: false });
// app.use(csrfProtection);

// Thêm CSRF token vào tất cả các response
// app.use((req, res, next) => {
//     res.locals.csrfToken = req.csrfToken();
//     next();
// });
const mongoConnect = require('./util/database').mongoConnect;
const User = require('./models/user');
const { notFoundHandler, errorHandler, handleLogoutNotifications, asyncHandler } = require('./middleware/errorHandler');
const validationMiddleware = require('./middleware/validation');
const imageHandler = require('./middleware/imageHandler');
const { logger, requestLogger } = require('./util/logger');
// const testUploadRoutes = require('./routes/test-upload');

const app = express();

console.log('=== [APP] Express app created ===');

// Bắt lỗi uncaught exception
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err, { fatal: true });
    process.exit(1);
});

// Bắt lỗi unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise }, { fatal: true });
    process.exit(1);
});

// Cấu hình session store
const store = new MongoDBStore({
    uri: 'mongodb+srv://ITCschool:8GZ4Vs2IufF9uwFY@cluster0.unzei.mongodb.net/Shop?retryWrites=true&w=majority&appName=Cluster0',
    collection: 'sessions'
});

// Xử lý lỗi store
store.on('error', function(error) {
    console.error('Session store error:', error);
});

// Cấu hình session
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        secure: false, // Set to true if using HTTPS
        httpOnly: true
    }
}));

console.log('=== [APP] Session middleware configured ===');

// Cấu hình flash messages
app.use(flash());

// Middleware để truyền flash messages vào views
app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    res.locals.infoMessage = req.flash('info');
    res.locals.warningMessage = req.flash('warning');
    next();
});

// AJAX response middleware
const ajaxResponseMiddleware = require('./middleware/ajax-response');
app.use(ajaxResponseMiddleware);

console.log('=== [APP] Flash middleware configured ===');

// Cấu hình body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

console.log('=== [APP] Body parser configured ===');

// Cấu hình static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount newsletter routes sớm để không bị middleware xác thực chặn
const newsletterRoutes = require('./routes/newsletter');
app.use('/newsletter', newsletterRoutes);

console.log('=== [APP] Static files configured ===');

// Cấu hình view engine
app.set('view engine', 'ejs');
app.set('views', 'views');

console.log('=== [APP] View engine configured ===');

// Middleware xử lý ảnh
app.use(imageHandler);

console.log('=== [APP] Image handler middleware configured ===');

// Middleware categories
const categoriesMiddleware = require('./middleware/categories');
app.use(categoriesMiddleware);

console.log('=== [APP] Categories middleware configured ===');

// Middleware cart
const cartMiddleware = require('./middleware/cart');
app.use(cartMiddleware);

console.log('=== [APP] Cart middleware configured ===');

// Import routes
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const servicesRoutes = require('./routes/services');
const newsRoutes = require('./routes/news');
const vnpayRoutes = require('./routes/vnpay');

console.log('=== [APP] Routes imported ===');

// Middleware để lấy thông tin user từ session
app.use(asyncHandler(async (req, res, next) => {
    let user = null;
    if (req.session.user) {
        try {
            user = await User.findById(req.session.user._id);
            if (user) {
                req.user = user;
            }
        } catch (err) {
            console.error('Error fetching user from session:', err);
        }
    }

    req.user = user;
    next();
}));

console.log('=== [APP] User middleware configured ===');

// Request logging middleware
app.use(requestLogger);

console.log('=== [APP] Request logger configured ===');

// Logout notifications middleware
app.use(handleLogoutNotifications);

console.log('=== [APP] Logout notifications middleware configured ===');

// Authentication middleware
app.use(asyncHandler(async (req, res, next) => {
    res.locals.isAuthenticated = req.session.user ? true : false;
    res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
    res.locals.user = req.session.user || null;

    // Lấy số lượng giỏ hàng từ session cart
    res.locals.cartCount = req.cart ? req.cart.getItemCount() : 0;

    // Lấy danh sách yêu thích
    let favorites = [];
    if (req.session.user && req.session.user._id) {
        try {
            // Luôn lấy từ database để đảm bảo dữ liệu mới nhất
            const userData = await User.findById(req.session.user._id);
            if (userData && Array.isArray(userData.favorites)) {
                favorites = userData.favorites.map(id => id.toString());

                // Cập nhật session để đồng bộ
                if (!req.session.user.favorites ||
                    req.session.user.favorites.length !== userData.favorites.length) {
                    req.session.user.favorites = userData.favorites;
                }

                console.log('🔍 DEBUG Navigation - Favorites count:', favorites.length);
                console.log('🔍 DEBUG Navigation - Favorites IDs:', favorites);
            }
        } catch (err) {
            console.error('Lỗi khi lấy favorites:', err);
        }
    }
    res.locals.favorites = favorites;

    logger.debug('Request authentication', {
        url: req.url,
        method: req.method,
        isAuthenticated: res.locals.isAuthenticated,
        isAdmin: res.locals.isAdmin,
        userId: req.session.user ? req.session.user._id : null,
        cartCount: res.locals.cartCount,
        favoritesCount: favorites.length
    });

    next();
}));

console.log('=== [APP] Authentication middleware configured ===');

// Middleware toàn cục: luôn truyền biến trạng thái đăng nhập cho mọi view
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
    next();
});

app.use('/admin', adminRoutes);
app.use('/vnpay', vnpayRoutes);
app.use('/services', servicesRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/contact', contactRoutes);
app.use('/news', newsRoutes);
// app.use(testUploadRoutes);

console.log('=== [APP] All routes mounted ===');

// Đặt bodyParser sau các route upload file, trước các route cần bodyParser
console.log('=== SETTING UP BODYPARSER ===');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
console.log('=== BODYPARSER SETUP COMPLETE ===');

app.use('/auth', authRoutes);

console.log('=== [APP] Auth routes mounted ===');

// Thêm các route chuyển hướng cho backward compatibility
app.get('/login', (req, res) => {
    res.redirect('/auth/login');
});

app.get('/signup', (req, res) => {
    res.redirect('/auth/signup');
});

console.log('=== [APP] Redirect routes configured ===');

app.post('/login', async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        
        if (!email || !password) {
            return res.redirect('/auth/login?error=invalid');
        }
        
        const user = await User.findByEmail(email);
        if (!user) {
            return res.redirect('/auth/login?error=invalid');
        }

        // Kiểm tra password (đơn giản - trong thực tế nên hash)
        if (user.password !== password) {
            return res.redirect('/auth/login?error=invalid');
        }

        // Đảm bảo user có role
        if (!user.role) {
            user.role = 'user'; // Set role mặc định là user
        }

        req.session.user = user;
        await req.session.save();
        console.log('✅ User logged in successfully:', user.email, 'Role:', user.role);
        
        // Redirect về trang trước đó nếu có, ngược lại về trang chủ
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo; // Xóa returnTo sau khi sử dụng
        
        if(user.role === 'admin') {
          return res.redirect('/admin/dashboard');
        }
        res.redirect(returnTo);
    } catch (err) {
        console.error('❌ Login error:', err);
        res.redirect('/auth/login?error=server');
    }
});

app.post('/logout', (req, res, next) => {
    console.log('🔄 Logout request received from:', req.ip);
    
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Lỗi khi đăng xuất:', err);
            return res.redirect('/?logout=error');
        }
        
        console.log('✅ Đăng xuất thành công');
        res.redirect('/?logout=success');
    });
});

app.use(shopRoutes);

console.log('=== [APP] Shop routes mounted ===');

// Middleware xử lý lỗi 404 và lỗi chung
app.use(notFoundHandler);
app.use(errorHandler);

console.log('=== [APP] Error handlers configured ===');

// Demo route for new header and footer
app.get('/demo', (req, res) => {
    res.render('demo-header-footer', {
        user: req.user,
        cartCount: req.session.cart ? req.session.cart.length : 0
    });
});

console.log('=== [APP] Demo route configured ===');

// Kết nối MongoDB và khởi động server
// Thêm vào phần startServer
const startServer = async () => {
    try {
        console.log('=== [SERVER] Starting server initialization ===');
        await new Promise((resolve, reject) => {
            mongoConnect((client) => { // client sẽ là undefined
                if (!client) {
                    console.error('MongoDB connection failed');
                    reject(new Error('MongoDB connection failed'));
                    return;
                }
                logger.info('MongoDB connected successfully');
                resolve();
            });
        });

        // Kết nối Mongoose cho các model sử dụng Mongoose (ví dụ: Category)
        mongoose.connect('mongodb+srv://ITCschool:8GZ4Vs2IufF9uwFY@cluster0.unzei.mongodb.net/Shop?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }).then(() => {
            console.log('Mongoose connected!');
        }).catch(err => {
            console.error('Mongoose connection error:', err);
        });

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Server started successfully`, {
                port,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });
            console.log('=== [SERVER] Server started successfully on port', port, '===');
        });
    } catch (err) {
        logger.error('Failed to start server', err);
        console.error('=== [SERVER] Failed to start server:', err, '===');
        process.exit(1);
    }
};

console.log('=== [APP] About to start server ===');
startServer();

