const User = require('../models/user');
const { sendPasswordChangeNotification, sendNewPassword, sendWelcomeEmail } = require('../util/email');

exports.getLogin = (req, res, next) => {
    // Nếu đã đăng nhập, redirect về trang trước đó hoặc trang chủ
    if (req.session.user) {
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        return res.redirect(returnTo);
    }
    
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Đăng nhập',
        error: null,
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
    });
};

exports.postLogin = async (req, res, next) => {
    try {
        console.log('🔍 Login attempt:', { email: req.body.email });
        
        const email = req.body.email;
        const password = req.body.password;
        
        // ===== VALIDATION DỮ LIỆU ĐẦU VÀO =====
        if (!email || !password) {
            return res.render('auth/login', {
                path: '/login',
                pageTitle: 'Đăng nhập',
                message: 'Vui lòng nhập đầy đủ email và mật khẩu',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // ===== XÁC THỰC USER =====
        const authResult = await User.authenticateUser(email, password);
        
        if (!authResult.success) {
            return res.render('auth/login', {
                path: '/login',
                pageTitle: 'Đăng nhập',
                message: authResult.message,
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        const user = authResult.user;
        
        // ===== LƯU USER VÀO SESSION =====
        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role || 'user'
        };
        
        await req.session.save();
        console.log('✅ User logged in successfully:', req.session.user);
        
        // ===== REDIRECT =====
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        
        if(user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        res.redirect(returnTo);
        
    } catch (err) {
        console.error('❌ Lỗi khi đăng nhập:', err);
        res.render('auth/login', {
            path: '/login',
            pageTitle: 'Đăng nhập',
            message: 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

// GET /forgot-password
exports.getForgotPassword = (req, res, next) => {
    res.render('auth/forgot-password', {
        path: '/forgot-password',
        pageTitle: 'Quên mật khẩu',
        error: null,
        success: null,
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
    });
};

// POST /forgot-password
exports.postForgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.render('auth/forgot-password', {
                path: '/forgot-password',
                pageTitle: 'Quên mật khẩu',
                error: 'Vui lòng nhập email của bạn',
                success: null,
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // Tìm user theo email
        const user = await User.findByEmail(email);
        if (!user) {
            // Không hiển thị lỗi để tránh lộ thông tin
            return res.render('auth/forgot-password', {
                path: '/forgot-password',
                pageTitle: 'Quên mật khẩu',
                error: null,
                success: 'Nếu email tồn tại, chúng tôi đã gửi mật khẩu mới đến email của bạn',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // Tạo mật khẩu mới 6 số
        const newPassword = await User.generateNewPassword(user._id);
        
        // Gửi email với mật khẩu mới
        const emailSent = await sendNewPassword(user, newPassword);
        
        if (emailSent) {
            return res.render('auth/forgot-password', {
                path: '/forgot-password',
                pageTitle: 'Quên mật khẩu',
                error: null,
                success: 'Mật khẩu mới đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư và đăng nhập.',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        } else {
            return res.render('auth/forgot-password', {
                path: '/forgot-password',
                pageTitle: 'Quên mật khẩu',
                error: 'Có lỗi xảy ra khi gửi email. Vui lòng thử lại sau.',
                success: null,
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }
    } catch (err) {
        console.error('Lỗi khi xử lý quên mật khẩu:', err);
        return res.render('auth/forgot-password', {
            path: '/forgot-password',
            pageTitle: 'Quên mật khẩu',
            error: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
            success: null,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};



exports.postLogout = (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Lỗi khi đăng xuất:', err);
        }
        res.redirect('/');
    });
};

exports.getProfile = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('profile', {
        path: '/profile',
        pageTitle: 'Thông tin cá nhân',
        user: req.session.user,
        isAuthenticated: true,
        isAdmin: req.session.user && req.session.user.role === 'admin'
    });
};

exports.getProfileEdit = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('profile-edit', {
        path: '/profile/edit',
        pageTitle: 'Chỉnh sửa thông tin cá nhân',
        user: req.session.user,
        error: null,
        success: null,
        isAuthenticated: true,
        isAdmin: req.session.user && req.session.user.role === 'admin'
    });
};

exports.postProfileEdit = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const newName = req.body.name;
        
        // Cập nhật tên người dùng trong DB
        await User.updateName(userId, newName);
        
        // Cập nhật session
        req.session.user.name = newName;
        await req.session.save();
        
        res.render('profile-edit', {
            path: '/profile/edit',
            pageTitle: 'Chỉnh sửa thông tin cá nhân',
            user: req.session.user,
            error: null,
            success: 'Cập nhật thông tin thành công',
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    } catch (err) {
        console.error(err);
        res.render('profile-edit', {
            path: '/profile/edit',
            pageTitle: 'Chỉnh sửa thông tin cá nhân',
            user: req.session.user,
            message: 'Có lỗi xảy ra khi cập nhật thông tin',
            success: null,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getChangePassword = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('profile-change-password', {
        path: '/profile/change-password',
        pageTitle: 'Đổi mật khẩu',
        error: null,
        success: null,
        isAuthenticated: true,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user
    });
};

exports.postChangePassword = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const oldPassword = req.body.oldPassword;
        const newPassword = req.body.newPassword;
        
        // Kiểm tra mật khẩu cũ
        const user = await User.findById(userId);
        if (!user) {
            return res.render('profile-change-password', {
                path: '/profile/change-password',
                pageTitle: 'Đổi mật khẩu',
                message: 'Người dùng không tồn tại',
                success: null,
                isAuthenticated: true,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user
            });
        }
        
        // Cập nhật mật khẩu
        await User.updatePassword(userId, newPassword);
        
        // Gửi email thông báo
        await sendPasswordChangeNotification(user, newPassword);
        
        res.render('profile-change-password', {
            path: '/profile/change-password',
            pageTitle: 'Đổi mật khẩu',
            error: null,
            success: 'Đổi mật khẩu thành công',
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user
        });
    } catch (err) {
        console.error(err);
        res.render('profile-change-password', {
            path: '/profile/change-password',
            pageTitle: 'Đổi mật khẩu',
            message: 'Có lỗi xảy ra khi đổi mật khẩu',
            success: null,
            isAuthenticated: true,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user
        });
    }
};

exports.getSignup = (req, res, next) => {
    if (req.session.user) {
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        return res.redirect(returnTo);
    }
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Đăng ký',
        message: null,
        isAuthenticated: false,
        isAdmin: false,
        user: null
    });
};

exports.postSignup = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword, phone, address } = req.body;
        
        // ===== VALIDATION DỮ LIỆU ĐẦU VÀO =====
        if (!name || !email || !password || !confirmPassword) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                message: 'Vui lòng nhập đầy đủ thông tin bắt buộc',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        if (password !== confirmPassword) {
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                message: 'Mật khẩu xác nhận không khớp',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // ===== TẠO USER MỚI =====
        const user = new User(name, email, password, 'user', []);
        
        try {
            await user.save();
            console.log('✅ User đăng ký thành công:', email);
            
            // ===== GỬI EMAIL CHÀO MỪNG =====
            try {
                await sendWelcomeEmail(user);
            } catch (emailError) {
                console.error('❌ Lỗi khi gửi email chào mừng:', emailError);
            }
            
            // ===== REDIRECT VỀ LOGIN =====
            req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập.');
            res.redirect('/auth/login');
            
        } catch (userError) {
            console.error('❌ Lỗi khi tạo user:', userError);
            
            let errorMessage = 'Có lỗi xảy ra khi đăng ký';
            
            if (userError.message.includes('Email đã được sử dụng')) {
                errorMessage = 'Email đã được sử dụng';
            } else if (userError.message.includes('Mật khẩu phải có ít nhất')) {
                errorMessage = userError.message;
            } else if (userError.message.includes('Mật khẩu quá yếu')) {
                errorMessage = userError.message;
            } else if (userError.message.includes('Mật khẩu không được chứa thông tin cá nhân')) {
                errorMessage = userError.message;
            } else if (userError.message.includes('Mật khẩu phải chứa ít nhất')) {
                errorMessage = userError.message;
            }
            
            return res.render('auth/signup', {
                path: '/signup',
                pageTitle: 'Đăng ký',
                message: errorMessage,
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }
        
    } catch (err) {
        console.error('❌ Lỗi khi đăng ký:', err);
        res.render('auth/signup', {
            path: '/signup',
            pageTitle: 'Đăng ký',
            message: 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};