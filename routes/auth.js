const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const User = require('../models/user');
const { sendPasswordChangeNotification } = require('../util/email');

// Thêm import authController
const authController = require('../controllers/auth');

// Thêm các import cần thiết
const isAuth = require('../middleware/is-auth');
const cartMiddleware = require('../middleware/cart');
const shopController = require('../controllers/shop');
const { validateUserRegistration } = require('../middleware/validation');
const upload = require('../middleware/avatar-upload');

console.log('=== [AUTH ROUTES] Auth routes loaded successfully ===');

// GET /login
router.get('/login', authController.getLogin);

// POST /login
router.post('/login', authController.postLogin);

// GET /forgot-password
router.get('/forgot-password', authController.getForgotPassword);

// POST /forgot-password
router.post('/forgot-password', authController.postForgotPassword);

// POST /logout
router.post('/logout', (req, res, next) => {
    console.log('🔄 Logout request received from:', req.ip);
    
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Lỗi khi đăng xuất:', err);
            // Redirect với thông báo lỗi
            return res.redirect('/?logout=error');
        }
        
        console.log('✅ Đăng xuất thành công');
        // Redirect với thông báo thành công
        res.redirect('/?logout=success');
    });
});

// GET /profile
router.get('/profile', async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    
    try {
        // Lấy thông tin thống kê từ database
        const User = require('../models/user');
        const Order = require('../models/order');
        
        // Lấy user mới nhất từ database để đảm bảo avatar được cập nhật
        const updatedUser = await User.findById(req.session.user._id);
        if (updatedUser) {
            // Cập nhật session với thông tin mới nhất
            req.session.user = { ...req.session.user, ...updatedUser };
            await req.session.save();
        }
        
        // Đếm số đơn hàng của user
        let orderCount = 0;
        try {
            orderCount = await Order.countDocuments({ userId: req.session.user._id });
        } catch (err) {
            orderCount = 0;
        }
        
        // Đếm số sản phẩm yêu thích
        const favoritesCount = req.session.user.favorites ? req.session.user.favorites.length : 0;
        
        // Cập nhật thông tin user với thống kê
        const userWithStats = {
            ...req.session.user,
            orderCount,
            favoritesCount
        };
        
        res.render('profile', {
            path: '/profile',
            pageTitle: 'Thông tin cá nhân',
            user: userWithStats,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            success: req.query.success
        });
    } catch (err) {
        console.error('=== [PROFILE] Lỗi khi tải trang profile:', err);
        console.error('=== [PROFILE] Error stack:', err.stack);
        res.render('profile', {
            path: '/profile',
            pageTitle: 'Thông tin cá nhân',
            user: req.session.user,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            success: req.query.success || null
        });
    }
});

// GET /profile/edit
router.get('/profile/edit', (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('profile-edit', {
        path: '/profile/edit',
        pageTitle: 'Chỉnh sửa thông tin cá nhân',
        user: req.session.user,
        isAuthenticated: true,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        error: null,
        success: null
    });
});

// POST /profile/edit
router.post('/profile/edit', upload.single('avatar'), async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    console.log('[DEBUG] req.body:', req.body);
    try {
        const { name, phone, address } = req.body;
        
        // Validation
        if (!name || name.trim().length === 0) {
            return res.render('profile-edit', {
                path: '/profile/edit',
                pageTitle: 'Chỉnh sửa thông tin cá nhân',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Vui lòng nhập họ tên',
                success: null
            });
        }
        
        if (name.trim().length < 2) {
            return res.render('profile-edit', {
                path: '/profile/edit',
                pageTitle: 'Chỉnh sửa thông tin cá nhân',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Họ tên phải có ít nhất 2 ký tự',
                success: null
            });
        }
        
        if (name.trim().length > 50) {
            return res.render('profile-edit', {
                path: '/profile/edit',
                pageTitle: 'Chỉnh sửa thông tin cá nhân',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Họ tên không được quá 50 ký tự',
                success: null
            });
        }
        
        // Validate phone number (optional)
        if (phone && phone.trim().length > 0) {
            const phoneRegex = /^[0-9+\-\s()]+$/;
            if (!phoneRegex.test(phone.trim())) {
                return res.render('profile-edit', {
                    path: '/profile/edit',
                    pageTitle: 'Chỉnh sửa thông tin cá nhân',
                    user: req.session.user,
                    isAuthenticated: true,
                    isAdmin: req.session.user && req.session.user.role === 'admin',
                    error: 'Số điện thoại không hợp lệ',
                    success: null
                });
            }
        }
        
        // Validate address length (optional)
        if (address && address.trim().length > 200) {
            return res.render('profile-edit', {
                path: '/profile/edit',
                pageTitle: 'Chỉnh sửa thông tin cá nhân',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Địa chỉ không được quá 200 ký tự',
                success: null
            });
        }
        
        // Xử lý avatar upload với multer
        let avatarUrl = req.session.user.avatarUrl; // Giữ nguyên avatar cũ
        if (req.file) {
            avatarUrl = `/images/avatars/${req.file.filename}`;
        }
        
        // Cập nhật thông tin user trong DB
        const User = require('../models/user');
        
        await User.updateProfile(req.session.user._id, {
            name: name.trim(),
            phone: phone ? phone.trim() : '',
            address: address ? address.trim() : '',
            avatarUrl: avatarUrl
        });
        
        // Cập nhật session
        req.session.user.name = name.trim();
        req.session.user.phone = phone ? phone.trim() : '';
        req.session.user.address = address ? address.trim() : '';
        req.session.user.avatarUrl = avatarUrl;
        await req.session.save();
        
        // Redirect về trang profile để hiển thị avatar mới
        res.redirect('/auth/profile?success=updated');
    } catch (err) {
        res.render('profile-edit', {
            path: '/profile/edit',
            pageTitle: 'Chỉnh sửa thông tin cá nhân',
            user: req.session.user,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            error: 'Có lỗi xảy ra khi cập nhật',
            success: null
        });
    }
});

// GET /profile/change-password
router.get('/profile/change-password', (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('profile-change-password', {
        path: '/profile/change-password',
        pageTitle: 'Đổi mật khẩu',
        user: req.session.user,
        isAuthenticated: true,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        error: null,
        success: null
    });
});

// POST /profile/change-password
router.post('/profile/change-password', async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    console.log('[DEBUG] req.body:', req.body);
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        
        // Validation
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Vui lòng nhập đầy đủ thông tin',
                success: null
            });
        }
        
        if (newPassword !== confirmPassword) {
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
                success: null
            });
        }
        
        if (newPassword.length < 6) {
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Mật khẩu mới phải có ít nhất 6 ký tự',
                success: null
            });
        }
        
        const User = require('../models/user');
        const PasswordUtils = require('../util/password');
        const user = await User.findById(req.session.user._id);
        if (!user) {
            throw new Error('Không tìm thấy user');
        }
        
        // Kiểm tra mật khẩu cũ
        const isMatch = await PasswordUtils.comparePassword(oldPassword, user.password);
        if (!isMatch) {
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Mật khẩu cũ không đúng',
                success: null
            });
        }
        
        console.log('[DEBUG] Bắt đầu xử lý đổi mật khẩu cho user:', req.session.user ? req.session.user.email : null);
        // Kiểm tra mật khẩu mới không được trùng với mật khẩu cũ
        if (oldPassword === newPassword) {
            console.log('[DEBUG] Mật khẩu mới trùng với mật khẩu cũ');
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Mật khẩu mới không được trùng với mật khẩu cũ',
                success: null
            });
        }
        
        // Thực hiện cập nhật mật khẩu
        console.log('[DEBUG] Gọi User.updatePassword với userId:', req.session.user._id);
        const updateResult = await User.updatePassword(req.session.user._id, newPassword);
        console.log('[DEBUG] Kết quả updatePassword:', updateResult);
        if (!updateResult || updateResult.modifiedCount === 0) {
            console.log('[DEBUG] Không cập nhật được mật khẩu cho user:', req.session.user._id);
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                error: 'Đổi mật khẩu thất bại. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
                success: null
            });
        }
        
        // Gửi email thông báo đổi mật khẩu
        try {
            await sendPasswordChangeNotification(user, newPassword);
        } catch (emailErr) {
            console.log('[DEBUG] Lỗi gửi email thông báo đổi mật khẩu:', emailErr);
        }
        
        console.log('[DEBUG] Đổi mật khẩu thành công cho user:', req.session.user.email);
        res.redirect('/auth/profile?success=password');
    } catch (err) {
        console.log('[DEBUG] Lỗi trong quá trình đổi mật khẩu:', err);
        res.render('profile-change-password', {
            path: '/profile/change-password',
            pageTitle: 'Đổi mật khẩu',
            user: req.session.user,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            error: 'Có lỗi xảy ra khi đổi mật khẩu',
            success: null
        });
    }
});

// GET /signup
router.get('/signup', (req, res, next) => {
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Đăng ký',
        error: null,
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
    });
});



// GET /signup-success
router.get('/signup-success', (req, res, next) => {
    
    if (!req.session.user) {
        return res.redirect('/');
    }
    
    // Kiểm tra cả flag và query parameter
    const hasSuccessFlag = req.session.signupSuccess;
    const hasSuccessQuery = req.query.success === 'true';
    
    if (!hasSuccessFlag && !hasSuccessQuery) {
        return res.redirect('/');
    }
    
    // Xóa flag để tránh hiển thị lại
    delete req.session.signupSuccess;
    
    res.render('auth/signup-success', {
        path: '/signup-success',
        pageTitle: 'Đăng ký thành công',
        user: req.session.user,
        isAuthenticated: true,
        isAdmin: req.session.user.role === 'admin'
    });
});

// POST /signup
router.post('/signup', validateUserRegistration, async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword, phone, address } = req.body;
        
        if (!name || !email || !password || !confirmPassword) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                error: 'Vui lòng nhập đầy đủ thông tin',
                isAuthenticated: false,
                isAdmin: false,
                user: null
            });
        }
        
        if (password !== confirmPassword) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                error: 'Mật khẩu nhập lại không khớp',
                isAuthenticated: false,
                isAdmin: false,
                user: null
            });
        }
        
        if (phone && !/^\d{10,11}$/.test(phone)) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                error: 'Số điện thoại không hợp lệ',
                isAuthenticated: false,
                isAdmin: false,
                user: null
            });
        }
        
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                error: 'Email đã được sử dụng',
                isAuthenticated: false,
                isAdmin: false,
                user: null
            });
        }
        
        // Lưu user mới
        const user = new User(name, email, password, 'user', [], phone, address);
        const newUser = await user.save();
        
        // Gửi email xác nhận
        const { sendSignupConfirmation } = require('../util/email');
        try {
            await sendSignupConfirmation(newUser);
        } catch (e) { 
            // Email confirmation failed, but continue
        }
        
        // Tự động đăng nhập
        req.session.user = newUser;
        await req.session.save();
        
        // Hiển thị thông báo thành công trước khi chuyển trang
        req.session.signupSuccess = true;
        await req.session.save();
        
        // Redirect đến trang success
        res.redirect('/auth/signup-success?success=true');
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        res.render('auth/signup', {
            path: '/signup',
            pageTitle: 'Đăng ký',
            error: 'Có lỗi xảy ra khi đăng ký',
            isAuthenticated: false,
            isAdmin: false,
            user: null
        });
    }
});



// Thêm các route orders vào auth.js
router.get('/orders', isAuth, cartMiddleware, shopController.getOrders);
router.get('/orders/:orderId', isAuth, cartMiddleware, shopController.getOrderDetail);
router.post('/orders/:orderId/delete', isAuth, cartMiddleware, shopController.deleteOrder);
router.post('/orders/delete-all', isAuth, cartMiddleware, shopController.deleteAllOrders);
router.post('/orders/:orderId/cancel', isAuth, cartMiddleware, shopController.cancelOrder);
router.get('/download-invoice/:orderId', isAuth, cartMiddleware, shopController.getDownloadInvoice);
router.get('/orders/:orderId/invoice', isAuth, cartMiddleware, shopController.getDownloadInvoice);
module.exports = router;