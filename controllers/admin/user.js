const User = require('../../models/user');
const { getDb } = require('../../util/database');
const { ObjectId } = require('mongodb');

exports.getUsers = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Không có quyền truy cập',
                path: '/error',
                message: 'Bạn không có quyền truy cập trang này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: false
            });
        }

        const db = getDb();
        // Lấy query filter
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Tạo filter cho MongoDB với server-side search
        const filter = {};
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { name: searchRegex },
                { email: searchRegex }
            ];
        }
        if (role && role.trim()) {
            filter.role = role.trim();
        }
        if (status && status.trim()) {
            filter.status = status.trim();
        }

        // Get total count for pagination
        const totalUsers = await db.collection('users').countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);
        
        // Get users with server-side pagination and sorting
        const users = await db.collection('users')
            .find(filter)
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit)
            .toArray();
        
        console.log('Server-side users search results:', {
            search,
            role,
            status,
            totalUsers,
            currentPage: page,
            resultsCount: users.length
        });

        res.render('admin/users', {
            pageTitle: 'Quản lý tài khoản',
            path: '/admin/accounts',
            users: users,
            search,
            role,
            status,
            // Pagination data
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null,
                limit
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách users:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải danh sách users',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.deleteUser = async (req, res, next) => {
  try {
    console.log('=== [ADMIN] Xóa user với userId:', req.params.userId);
    const db = getDb();
    
    // Kiểm tra user có tồn tại không
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy người dùng' 
      });
    }
    
    // Không cho phép xóa chính mình
    if (req.params.userId === req.session.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể xóa tài khoản của chính mình' 
      });
    }
    
    // Xóa user
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.userId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy người dùng để xóa' 
      });
    }
    
    console.log('=== [ADMIN] Xóa user thành công:', user.email);
    res.json({ 
      success: true, 
      message: 'Xóa người dùng thành công' 
    });
  } catch (err) {
    console.error('=== [ADMIN] Lỗi khi xóa user:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Có lỗi xảy ra khi xóa người dùng' 
    });
  }
};

exports.getCreateUser = (req, res) => {
  res.render('admin/user-create', {
    pageTitle: 'Thêm người dùng mới',
    path: '/admin/accounts/create',
    error: null,
    success: null,
    oldInput: { name: '', email: '', role: 'user', status: 'active', phone: '', address: '' }
  });
};

exports.postCreateUser = async (req, res, next) => {
  try {
    const db = getDb();
    const { name, email, password, role, status, phone, address, sendWelcomeEmail, sendCredentials } = req.body;
    
    if (!name || !email || !password) {
      return res.render('admin/user-create', {
        pageTitle: 'Thêm người dùng mới',
        path: '/admin/accounts/create',
        error: 'Vui lòng nhập đầy đủ thông tin bắt buộc',
        success: null,
        oldInput: { name, email, role, status, phone, address }
      });
    }

    // Kiểm tra email đã tồn tại
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.render('admin/user-create', {
        pageTitle: 'Thêm người dùng mới',
        path: '/admin/accounts/create',
        error: 'Email đã tồn tại trong hệ thống',
        success: null,
        oldInput: { name, email, role, status, phone, address }
      });
    }

    console.log('[Admin Create User] Dữ liệu nhận được:', { name, email, role, status });
    // Sử dụng model User để đảm bảo hash mật khẩu
    const User = require('../../models/user');
    const newUser = new User(
      name,
      email,
      password,
      role || 'user',
      [],
      phone,
      address,
      status || 'active'
    );
    
    console.log('[Admin Create User] Chuẩn bị lưu người dùng mới...');
    try {
        const createdUser = await newUser.save();
        console.log('[Admin Create User] Đã lưu người dùng thành công, ID:', createdUser._id);

        // Gửi email nếu được yêu cầu
        if (sendWelcomeEmail === 'true') {
            console.log(`[Admin Create User] Đang gửi email chào mừng đến ${createdUser.email}...`);
            const { sendWelcomeEmail: sendWelcome } = require('../../util/email');
            await sendWelcome(createdUser);
        }

        if (sendCredentials === 'true') {
            console.log(`[Admin Create User] Đang gửi thông tin đăng nhập đến ${createdUser.email}...`);
            const { sendPasswordChangeNotification } = require('../../util/email');
            await sendPasswordChangeNotification(createdUser, password);
        }
    } catch (e) {
      console.error('[Admin Create User] Lỗi trong quá trình lưu hoặc gửi email:', e);
    }


    res.render('admin/user-create', {
      pageTitle: 'Thêm người dùng mới',
      path: '/admin/accounts/create',
      error: null,
      success: 'Tạo người dùng thành công!',
      oldInput: { name: '', email: '', role: 'user', status: 'active', phone: '', address: '' }
    });
  } catch (err) {
    console.error('[Admin Create User] Lỗi nghiêm trọng trong hàm postCreateUser:', err);
    next(err);
  }
};

exports.getEditUser = async (req, res, next) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });
    if (!user) {
      return res.redirect('/admin/accounts');
    }

    // Get user statistics
    const orderCount = await db.collection('orders').countDocuments({ userId: user._id });
    const reviewCount = await db.collection('reviews').countDocuments({ userId: user._id });
    const favoriteCount = await db.collection('favorites').countDocuments({ userId: user._id });
    
    // Calculate total spent
    const orders = await db.collection('orders').find({ userId: user._id }).toArray();
    const totalSpent = orders.reduce((total, order) => total + (order.totalPrice || 0), 0);

    // Add statistics to user object
    const userWithStats = {
      ...user,
      orderCount,
      reviewCount,
      favoriteCount,
      totalSpent
    };

    res.render('admin/user-edit', {
      pageTitle: 'Chỉnh sửa tài khoản',
      path: '/admin/accounts',
      error: null,
      success: null,
      user: userWithStats
    });
  } catch (err) {
    next(err);
  }
};

exports.postEditUser = async (req, res, next) => {
  try {
    const db = getDb();
    const { name, email, role, status, phone, address } = req.body;
    
    if (!name || !email) {
      const user = { _id: req.params.userId, name, email, role, status, phone, address };
      return res.render('admin/user-edit', {
        pageTitle: 'Chỉnh sửa tài khoản',
        path: '/admin/accounts',
        error: 'Vui lòng nhập đầy đủ thông tin bắt buộc',
        success: null,
        user
      });
    }

    // Check if email already exists for another user
    const existingUser = await db.collection('users').findOne({ 
      email: email, 
      _id: { $ne: new ObjectId(req.params.userId) } 
    });
    
    if (existingUser) {
      const user = { _id: req.params.userId, name, email, role, status, phone, address };
      return res.render('admin/user-edit', {
        pageTitle: 'Chỉnh sửa tài khoản',
        path: '/admin/accounts',
        error: 'Email đã được sử dụng bởi người dùng khác',
        success: null,
        user
      });
    }

    // Update user information
    const updateData = {
      name,
      email,
      role: role || 'user',
      status: status || 'active',
      phone: phone || '',
      address: address || '',
      updatedAt: new Date()
    };

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: updateData }
    );

    // Get updated user with statistics
    const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(req.params.userId) });
    const orderCount = await db.collection('orders').countDocuments({ userId: updatedUser._id });
    const reviewCount = await db.collection('reviews').countDocuments({ userId: updatedUser._id });
    const favoriteCount = await db.collection('favorites').countDocuments({ userId: updatedUser._id });
    const orders = await db.collection('orders').find({ userId: updatedUser._id }).toArray();
    const totalSpent = orders.reduce((total, order) => total + (order.totalPrice || 0), 0);

    const userWithStats = {
      ...updatedUser,
      orderCount,
      reviewCount,
      favoriteCount,
      totalSpent
    };

    res.render('admin/user-edit', {
      pageTitle: 'Chỉnh sửa tài khoản',
      path: '/admin/accounts',
      error: null,
      success: 'Thông tin tài khoản đã được cập nhật thành công',
      user: userWithStats
    });
  } catch (err) {
    next(err);
  }
};

// Change user password
exports.postChangeUserPassword = async (req, res, next) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const userId = req.params.userId;

    // Validation
    if (!newPassword || !confirmPassword) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: 'Vui lòng nhập đầy đủ mật khẩu mới và xác nhận',
          errors: {
            newPassword: !newPassword ? 'Vui lòng nhập mật khẩu mới' : null,
            confirmPassword: !confirmPassword ? 'Vui lòng nhập xác nhận mật khẩu' : null
          }
        });
      }
      req.flash('error', 'Vui lòng nhập đầy đủ mật khẩu mới và xác nhận');
      return res.redirect(`/admin/accounts/${userId}/edit`);
    }

    if (newPassword !== confirmPassword) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: 'Mật khẩu xác nhận không khớp',
          errors: {
            confirmPassword: 'Mật khẩu xác nhận không khớp'
          }
        });
      }
      req.flash('error', 'Mật khẩu xác nhận không khớp');
      return res.redirect(`/admin/accounts/${userId}/edit`);
    }

    // ===== CẬP NHẬT MẬT KHẨU VỚI MÃ HÓA =====
    try {
      await User.updatePassword(userId, newPassword);
    } catch (passwordError) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: passwordError.message,
          errors: {
            newPassword: passwordError.message
          }
        });
      }
      req.flash('error', passwordError.message);
      return res.redirect(`/admin/accounts/${userId}/edit`);
    }

    // ===== GỬI EMAIL THÔNG BÁO =====
    try {
      const user = await User.findById(userId);
      const { sendPasswordChangeNotification } = require('../../util/email');
      await sendPasswordChangeNotification(user, newPassword);
    } catch (e) {
      console.error('Không gửi được email thông báo:', e);
    }

    // Nếu là AJAX request
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ 
        success: true, 
        message: 'Mật khẩu đã được thay đổi thành công' 
      });
    }

    req.flash('success', 'Mật khẩu đã được thay đổi thành công');
    res.redirect(`/admin/accounts/${userId}/edit`);
  } catch (err) {
    console.error('Lỗi khi thay đổi mật khẩu:', err);
    
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ 
        success: false, 
        message: 'Có lỗi xảy ra khi thay đổi mật khẩu' 
      });
    }
    
    next(err);
  }
};

// Send welcome email to user
exports.postSendWelcomeEmail = async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.params.userId;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Send welcome email
    try {
      const { sendWelcomeEmail } = require('../../util/email');
      await sendWelcomeEmail(user);
    } catch (e) {
      console.error('Không gửi được email chào mừng:', e);
      return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi gửi email' });
    }

    res.json({ success: true, message: 'Email chào mừng đã được gửi thành công' });
  } catch (err) {
    console.error('Lỗi khi gửi email chào mừng:', err);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi gửi email' });
  }
};

// Reset user password
exports.postResetUserPassword = async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.params.userId;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Generate new password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-4) + '1!';

    // Update password
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: newPassword, updatedAt: new Date() } }
    );

    // Send email with new password
    try {
      const { sendPasswordResetNotification } = require('../../util/email');
      await sendPasswordResetNotification(user, newPassword);
    } catch (e) {
      console.error('Không gửi được email thông báo reset mật khẩu:', e);
      return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi gửi email' });
    }

    res.json({ success: true, message: 'Mật khẩu đã được reset và gửi qua email' });
  } catch (err) {
    console.error('Lỗi khi reset mật khẩu:', err);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi reset mật khẩu' });
  }
};

// These functions were found in routes but not in controller, adding them here.
exports.postQuickCreateUser = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.postBulkImportUsers = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.getUserStatistics = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
}; 