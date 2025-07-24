const User = require('../models/user');

module.exports = async (req, res, next) => {
    try {
        console.log('🔐 Checking auth for:', req.url);
        console.log('🔐 Session exists:', !!req.session);
        console.log('🔐 Session user:', !!req.session?.user);
        console.log('🔐 Session details:', req.session);
        
        if (!req.session.user) {
            console.log('❌ Chưa đăng nhập, chuyển hướng đến trang login');
            // Lưu URL hiện tại để redirect sau khi đăng nhập
            req.session.returnTo = req.originalUrl;
            
            // Nếu là AJAX request, trả về JSON thay vì redirect
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({
                    success: false,
                    message: 'Bạn cần đăng nhập để thực hiện hành động này',
                    redirect: '/auth/login'
                });
            }
            
            return res.redirect('/auth/login');
        }

        if (!req.session.user._id) {
            console.log('❌ User không có _id, chuyển hướng đến trang login');
            // Lưu URL hiện tại để redirect sau khi đăng nhập
            req.session.returnTo = req.originalUrl;
            
            // Nếu là AJAX request, trả về JSON thay vì redirect
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({
                    success: false,
                    message: 'Phiên đăng nhập không hợp lệ',
                    redirect: '/auth/login'
                });
            }
            
            return res.redirect('/auth/login');
        }

        // Kiểm tra trạng thái tài khoản trong database
        const user = await User.findById(req.session.user._id);
        if (!user || user.status === 'suspended') {
            console.log('❌ Tài khoản bị tạm khóa, đăng xuất và chuyển hướng');
            req.session.destroy((err) => {
                if (err) {
                    console.error('Lỗi khi đăng xuất:', err);
                }
                
                // Nếu là AJAX request, trả về JSON thay vì redirect
                if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.status(403).json({
                        success: false,
                        message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.',
                        redirect: '/auth/login'
                    });
                }
                
                return res.redirect('/auth/login');
            });
            return;
        }

        console.log('✅ Auth passed for user:', req.session.user._id);
        next();
    } catch (error) {
        console.error('🚨 Error in is-auth middleware:', error);
        return res.status(500).json({ message: 'Authentication error' });
    }
};