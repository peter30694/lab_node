const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const Category = require('../models/category');
const Review = require('../models/review');

const { sendOrderConfirmation, sendNewOrderNotification } = require('../util/email');
const mongodb = require('mongodb');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { generateOrderPDF } = require('../util/pdf');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

exports.getProducts = async (req, res, next) => {
    try {
        // Kiểm tra nếu user là admin thì redirect đến trang quản lý sản phẩm
        if (req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/admin/products');
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const sort = req.query.sort || '';

        // Build filter object
        let filter = {};
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) {
            filter.category = category;
        }

        // Lấy danh mục cho navigation
        const categories = await Category.find();

        // Lấy tất cả sản phẩm phù hợp filter
        let products = await Product.find(filter);

        // Sắp xếp thủ công
        switch (sort) {
            case 'price_asc':
                products = products.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price_desc':
                products = products.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'name_asc':
                products = products.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'name_desc':
                products = products.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                break;
            default:
                products = products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        // Phân trang thủ công
        const totalProducts = products.length;
        const totalPages = Math.ceil(totalProducts / limit);
        products = products.slice(skip, skip + limit);

        // Lấy số lượng sản phẩm trong giỏ hàng
        let cartCount = 0;
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && userData.cart && Array.isArray(userData.cart.items)) {
                cartCount = userData.cart.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        }

        let favorites = [];
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && Array.isArray(userData.favorites)) {
                favorites = userData.favorites.map(id => id.toString());
            }
        }
        res.render('shop/product-list', {
            products: products,
            pageTitle: 'Sản phẩm - PetShop',
            path: '/products',
            currentPage: page,
            totalPages: totalPages,
            totalProducts: totalProducts,
            search: search,
            category: category,
            sort: sort,
            hasProducts: products.length > 0,
            activeShop: true,
            productCSS: true,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount,
            favorites,
            categories
        });
    } catch (err) {
        console.log(err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi | PetShop',
            path: '/error',
            message: 'Không thể tải danh sách sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getProduct = async (req, res, next) => {
    try {
        const prodId = req.params.productId;
        const product = await Product.findById(prodId);
        const userId = req.session.user ? req.session.user._id : null;

        // DEBUG: Log session và userId
        console.log('DEBUG getProduct - req.session.user:', req.session.user);
        console.log('DEBUG getProduct - userId:', userId);

        if (!product) {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy sản phẩm | Pet Store',
                path: '/404',
                message: 'Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.',
                url: req.originalUrl,
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Lấy danh mục cho navigation
        const categories = await Category.find();

        // Lấy các sản phẩm liên quan (cùng loại hoặc giá tương đương)
        const relatedProducts = await Product.findRelatedProducts(product);

        // Điều kiện lọc: lấy đánh giá đã được duyệt HOẶC đánh giá của người dùng hiện tại
        let filter;
        if (userId) {
            filter = {
                productId: new mongodb.ObjectId(prodId),
                $or: [
                    { status: 'approved' },
                    { userId: new mongodb.ObjectId(userId), status: { $ne: 'rejected' } }
                ]
            };
        } else {
            filter = {
                productId: new mongodb.ObjectId(prodId),
                status: 'approved'
            };
        }

        // Lấy đánh giá cho sản phẩm với filter mới
        const reviewsData = await Review.fetchAll(1, 10, filter);

        // Lấy thông tin user cho mỗi review
        const reviewsWithUser = await Promise.all(
            reviewsData.reviews.map(async (review) => {
                const user = await User.findById(review.userId);
                return {
                    ...review,
                    userName: user ? user.name : 'Khách hàng',
                    userAvatar: user ? user.avatar : null,
                    isCurrentUserReview: review.userId === userId,
                    isPending: review.status === 'pending',
                    // Đảm bảo trả về các trường phản hồi admin
                    adminReply: review.adminReply,
                    adminReplyDate: review.adminReplyDate
                };
            })
        );

        let favorites = [];
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && Array.isArray(userData.favorites)) {
                favorites = userData.favorites.map(id => id.toString());
            }
        }
        console.log('--- DEBUG: Dữ liệu sản phẩm trước khi render ---');
        console.log(product);
        console.log('-------------------------------------------');
        res.render('shop/product-detail', {
            product: product,
            pageTitle: `${product.title} | PetShop`,
            path: '/products',
            relatedProducts: relatedProducts,
            hasRelatedProducts: relatedProducts.length > 0,
            activeShop: true,
            productCSS: true,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            favorites,
            categories,
            reviews: reviewsWithUser,
            reviewsCount: parseInt(reviewsData.total) || 0
        });
    } catch (err) {
        console.log(err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi | Pet Store',
            path: '/error',
            message: 'Không thể tải thông tin sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getIndex = async (req, res, next) => {
    try {
        // Kiểm tra nếu user là admin thì redirect đến dashboard
        if (req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        
        // Get featured products (latest 8 products)
        const allProducts = await Product.find();
        const products = allProducts.slice(0, 8);

        // Lấy danh mục cho navigation
        const categories = await Category.find();

        // Sử dụng session cart cho tất cả người dùng
        const cartCount = req.cart.getItemCount();

        // Kiểm tra thông báo đăng xuất thành công
        let logoutSuccess = false;
        let logoutError = false;
        if (req.query.logout === 'success') {
            logoutSuccess = true;
        } else if (req.query.logout === 'error') {
            logoutError = true;
        }
        let favorites = [];
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && Array.isArray(userData.favorites)) {
                favorites = userData.favorites.map(id => id.toString());
            }
        }
        res.render('shop/index', {
            products: products,
            pageTitle: 'PetShop - Cửa hàng thú cưng',
            path: '/',
            hasProducts: products.length > 0,
            activeShop: true,
            productCSS: true,
            logoutSuccess: logoutSuccess,
            logoutError: logoutError,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount,
            favorites,
            categories
        });
    } catch (err) {
        console.log(err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi | Pet Store',
            path: '/error',
            message: 'Không thể tải trang chủ',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getCart = async (req, res, next) => {
    try {
        // Kiểm tra nếu user là admin thì redirect đến trang quản lý đơn hàng
        if (req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/admin/orders');
        }
        
        // Sử dụng giỏ hàng session cho tất cả người dùng
        const cart = req.cart.getCart();

        console.log('🛒 Cart data:', {
            items: cart.items,
            totalPrice: cart.totalPrice,
            itemCount: cart.items ? cart.items.length : 0
        });

        // Import shipping calculator
        const shippingCalculator = require('../util/shipping-calculator');
        
        res.render('shop/cart', {
            path: '/cart',
            pageTitle: 'Giỏ hàng của bạn',
            products: cart.items || [],
            totalPrice: cart.totalPrice || 0,
            activeCart: true,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart.getItemCount(),
            logoutSuccess: req.query.logout === 'success',
            logoutError: req.query.logout === 'error',
            calculateShippingFee: (totalPrice) => shippingCalculator.calculateShippingFee(totalPrice),
            calculateTotalAmount: (totalPrice, shippingFee) => shippingCalculator.calculateTotalAmount(totalPrice, 0).total,
            formatCurrency: (amount) => new Intl.NumberFormat('vi-VN').format(amount)
        });
    } catch (err) {
        console.error('Lỗi khi tải giỏ hàng:\n', err.stack || err);
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể tải giỏ hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.postCart = async (req, res, next) => {
    try {
        const prodId = req.body.productId;
        const quantity = parseInt(req.body.quantity) || 1;

        if (!prodId) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(400).json({
                    success: false,
                    message: 'Không có sản phẩm được chọn'
                });
            }
            return res.status(400).render('error/500', {
                pageTitle: 'Error',
                path: '/error',
                message: 'Không có sản phẩm được chọn',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        try {
            // Sử dụng giỏ hàng session
            const cart = await req.cart.addToCart(prodId, quantity);

            // Check if this is an AJAX request
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.json({
                    success: true,
                    message: 'Đã thêm sản phẩm vào giỏ hàng',
                    cartCount: req.cart.getItemCount()
                });
            }

            res.redirect('/cart');
        } catch (err) {
            // Nếu lỗi liên quan đến số lượng tồn kho, hiển thị thông báo lỗi
            if (err.message.includes('Số lượng vượt quá tồn kho') || err.message.includes('Không tìm thấy sản phẩm')) {
                if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.status(400).json({
                        success: false,
                        message: err.message
                    });
                }
                return res.status(400).render('error/validation', {
                    pageTitle: 'Lỗi Dữ Liệu',
                    path: '/error',
                    message: err.message,
                    isAuthenticated: req.session.user ? true : false,
                    isAdmin: req.session.user && req.session.user.role === 'admin'
                });
            }
            throw err;
        }
    } catch (err) {
        console.error('Lỗi khi thêm vào giỏ hàng:\n', err.stack || err);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({
                success: false,
                message: 'Không thể thêm sản phẩm vào giỏ hàng'
            });
        }
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể thêm sản phẩm vào giỏ hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.postCartDeleteProduct = async (req, res, next) => {
    try {
        console.log('🗑️ Starting postCartDeleteProduct');
        console.log('🗑️ Request body:', req.body);

        const prodId = req.body.productId;
        console.log('🗑️ Product ID to delete:', prodId);

        if (!prodId) {
            console.log('🗑️ No product ID provided');
            return res.status(400).render('error/500', {
                pageTitle: 'Error',
                path: '/error',
                message: 'Không có sản phẩm được chọn',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Sử dụng giỏ hàng session
        const result = req.cart.removeFromCart(prodId);
        console.log('🗑️ Cart after removal:', result);

        res.redirect('/cart');
    } catch (err) {
        console.error('🗑️ Error in postCartDeleteProduct:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể xóa sản phẩm khỏi giỏ hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

// Xóa tất cả sản phẩm khỏi giỏ hàng
exports.postCartDeleteAll = async (req, res, next) => {
    try {
        console.log('🗑️ Starting postCartDeleteAll');

        // Xóa tất cả sản phẩm khỏi giỏ hàng session
        req.cart.clearCart();
        console.log('🗑️ Cart cleared successfully');

        // Kiểm tra nếu là AJAX request
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                success: true,
                message: 'Đã xóa tất cả sản phẩm khỏi giỏ hàng',
                cartCount: 0
            });
        }

        res.redirect('/cart');
    } catch (err) {
        console.error('🗑️ Error in postCartDeleteAll:', err);

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({
                success: false,
                message: 'Không thể xóa tất cả sản phẩm khỏi giỏ hàng'
            });
        }

        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể xóa tất cả sản phẩm khỏi giỏ hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.postCartUpdateQuantity = async (req, res, next) => {
    try {
        const prodId = req.body.productId;
        const quantity = parseInt(req.body.quantity) || 1;

        if (!prodId) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(400).json({
                    success: false,
                    message: 'Không có sản phẩm được chọn'
                });
            }
            return res.status(400).render('error/validation', {
                pageTitle: 'Lỗi Dữ Liệu',
                path: '/error',
                message: 'Không có sản phẩm được chọn',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        try {
            // Sử dụng giỏ hàng session
            await req.cart.updateQuantity(prodId, quantity);
            
            // Check if this is an AJAX request
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                const cart = req.cart.getCart();
                return res.json({
                    success: true,
                    message: 'Đã cập nhật số lượng sản phẩm',
                    totalPrice: cart.totalPrice,
                    cartCount: cart.items.length
                });
            }
            
            res.redirect('/cart');
        } catch (err) {
            // Nếu lỗi liên quan đến số lượng tồn kho
            if (err.message.includes('Số lượng vượt quá tồn kho') || err.message.includes('Không tìm thấy sản phẩm')) {
                if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.status(400).json({
                        success: false,
                        message: err.message
                    });
                }
                return res.status(400).render('error/validation', {
                    pageTitle: 'Lỗi Dữ Liệu',
                    path: '/error',
                    message: err.message,
                    isAuthenticated: req.session.user ? true : false,
                    isAdmin: req.session.user && req.session.user.role === 'admin'
                });
            }
            throw err;
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật số lượng:\n', err.stack || err);
        
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({
                success: false,
                message: 'Không thể cập nhật số lượng sản phẩm'
            });
        }
        
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể cập nhật số lượng sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.postOrder = async (req, res, next) => {
    try {
        console.log('🛒 Starting postOrder controller');
        console.log('🛒 Request body:', req.body);

        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để đặt hàng'
            });
        }

        // ✅ SỬA LỖI: Khai báo couponId riêng để có thể gán lại
        const { paymentMethod, name, phone, email, address, note, couponCode, couponDiscount, couponValid } = req.body;
        let couponId = req.body.couponId; // Khai báo riêng để có thể gán lại

        console.log('🛒 Shipping info:', { name, phone, email, address });
        console.log('🛒 Payment method:', paymentMethod);

        // Validate payment method
        const validPaymentMethods = ['cod', 'vnpay'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Phương thức thanh toán không hợp lệ'
            });
        }

        const userData = await User.findById(req.session.user._id);
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin người dùng'
            });
        }

        // Lấy giỏ hàng từ session (dùng cho cả user và guest)
        const cart = req.cart.getCart();
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Giỏ hàng trống'
            });
        }

        // ===== KIỂM TRA TỒN KHO TRƯỚC KHI ĐẶT HÀNG =====
        console.log('🔍 Kiểm tra tồn kho cho đơn hàng...');
        const stockValidation = await validateStockForOrder(cart.items);
        if (!stockValidation.valid) {
            return res.status(400).json({
                success: false,
                message: stockValidation.message,
                outOfStockItems: stockValidation.outOfStockItems
            });
        }
        console.log('✅ Tồn kho hợp lệ, tiếp tục tạo đơn hàng');

        // ===== KIỂM TRA TRÙNG LẶP ĐƠN HÀNG =====
        console.log('🔍 Kiểm tra trùng lặp đơn hàng...');
        try {
            const duplicateCheck = await Order.checkDuplicateOrder(req.session.user._id, cart.items);
            if (duplicateCheck.hasDuplicate) {
                console.log('⚠️ Phát hiện đơn hàng trùng lặp:', duplicateCheck.message);
                return res.status(409).json({
                    success: false,
                    message: duplicateCheck.message,
                    errorType: 'duplicate_order'
                });
            }
            console.log('✅ Không có trùng lặp đơn hàng');
        } catch (duplicateErr) {
            console.error('❌ Lỗi khi kiểm tra trùng lặp:', duplicateErr);
            // Nếu có lỗi khi kiểm tra trùng lặp, vẫn tiếp tục tạo đơn hàng
            console.log('⚠️ Tiếp tục tạo đơn hàng dù có lỗi kiểm tra trùng lặp');
        }

        const products = cart.items.map(item => {
            return {
                productId: item.productId,
                quantity: item.quantity,
                title: item.title,
                price: item.price,
                imageUrl: item.imageUrl
            };
        });

        // Tính phí vận chuyển
        const subtotal = cart.totalPrice;
        console.log('🛒 Cart data:', {
            items: cart.items,
            totalPrice: cart.totalPrice,
            subtotal: subtotal
        });
        
        const shippingCalculator = require('../util/shipping-calculator');
        const shippingInfo = shippingCalculator.calculateShippingFee(subtotal);
        const shippingFee = shippingInfo.fee;

        // Xử lý mã giảm giá
        let discountAmount = 0;
        let appliedCoupon = null;

        console.log('🛒 Coupon data from form:', { 
            couponCode, 
            couponDiscount, 
            couponId, 
            couponValid,
            couponDiscountType: typeof couponDiscount,
            couponDiscountParsed: parseFloat(couponDiscount)
        });

        if (couponCode && couponValid === 'true' && couponDiscount && couponId) {
            console.log('✅ Sử dụng mã giảm giá từ form');
            discountAmount = parseFloat(couponDiscount) || 0;
            console.log('🛒 Discount amount calculated:', discountAmount);
            
            // Tạo appliedCoupon object từ thông tin đã validate
            const Coupon = require('../models/coupon');
            try {
                const coupon = await Coupon.findById(couponId);
                if (coupon) {
                    appliedCoupon = {
                        code: coupon.code,
                        discountType: coupon.discountType,
                        discountValue: coupon.discountValue,
                        name: coupon.discountType === 'percentage' 
                            ? `Giảm ${coupon.discountValue}%` 
                            : `Giảm ${coupon.discountValue.toLocaleString('vi-VN')}đ`
                    };
                    console.log('✅ Mã giảm giá hợp lệ, appliedCoupon object:', appliedCoupon);
                } else {
                    console.log('⚠️ Không tìm thấy coupon trong database, bỏ qua');
                    discountAmount = 0;
                    appliedCoupon = null;
                    couponId = null; // ✅ SỬA LỖI: Reset couponId nếu không tìm thấy
                }
            } catch (err) {
                console.error('❌ Lỗi khi tìm coupon:', err);
                discountAmount = 0;
                appliedCoupon = null;
                couponId = null; // ✅ SỬA LỖI: Reset couponId nếu có lỗi
            }
        } else if (couponCode) {
            // Fallback: validate lại mã giảm giá
            console.log('🔄 Validate lại mã giảm giá...');
            const Coupon = require('../models/coupon');
            const couponValidation = await Coupon.validateCoupon(couponCode, subtotal, req.session.user._id);
            
            if (couponValidation.valid) {
                appliedCoupon = {
                    code: couponValidation.coupon.code,
                    discountType: couponValidation.coupon.discountType,
                    discountValue: couponValidation.coupon.discountValue,
                    name: couponValidation.coupon.discountType === 'percentage' 
                        ? `Giảm ${couponValidation.coupon.discountValue}%` 
                        : `Giảm ${couponValidation.coupon.discountValue.toLocaleString('vi-VN')}đ`
                };
                discountAmount = couponValidation.discountAmount;
                // ✅ SỬA LỖI: Gán lại couponId từ validation result
                couponId = couponValidation.coupon._id.toString();
                console.log('✅ Mã giảm giá hợp lệ (fallback), couponId:', couponId);
            } else {
                console.log('❌ Mã giảm giá không hợp lệ:', couponValidation.message);
                return res.status(400).json({
                    success: false,
                    message: couponValidation.message
                });
            }
        }

        // ===== TÍNH TỔNG TIỀN TRƯỚC KHI TẠO ORDER =====
        const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
        console.log('🛒 Total amount calculation:', {
            subtotal,
            shippingFee,
            discountAmount,
            totalAmount,
            appliedCoupon: appliedCoupon ? {
                code: appliedCoupon.code,
                discountType: appliedCoupon.discountType,
                discountValue: appliedCoupon.discountValue
            } : null
        });
        
        // ===== VALIDATE TỔNG TIỀN ĐƠN HÀNG =====
        console.log('🛒 Creating order with data:', {
            userId: req.session.user._id,
            productsCount: products.length,
            totalAmount,
            shippingFee,
            appliedCoupon,
            discountAmount
        });
        
        const order = new Order(
            req.session.user._id,
            products,
            totalAmount, // Tính trước tổng tiền
            {
                name: name,
                phone: phone,
                email: email,
                address: address,
                note: note || ''
            },
            paymentMethod,
            shippingFee,
            appliedCoupon
        );
        
        // Ghi đè discountAmount đã tính từ controller
        order.discountAmount = discountAmount;
        console.log('🛒 Order created with discountAmount:', order.discountAmount);

        // Sử dụng transaction để đảm bảo tính toàn vẹn
        const result = await createOrderWithStockReservation(order, cart.items);
        console.log('🛒 Order saved:', result);

        // Ghi lại việc sử dụng mã giảm giá nếu có
        console.log('🔍 Debug coupon usage recording:');
        console.log('   - appliedCoupon:', appliedCoupon);
        console.log('   - couponId:', couponId);
        console.log('   - couponId type:', typeof couponId);
        console.log('   - orderId:', result.insertedId || order._id);
        console.log('   - userId:', req.session.user._id);
        
        // ✅ SỬA LỖI: CHỈ ghi nhận sử dụng mã giảm giá cho COD, KHÔNG ghi nhận cho VNPay
        // VNPay sẽ ghi nhận khi thanh toán thành công trong vnpay.js
        if (appliedCoupon && paymentMethod === 'cod') {
            try {
                // Đảm bảo có couponId hợp lệ
                let validCouponId = couponId;
                
                // Nếu không có couponId, tìm từ appliedCoupon.code
                if (!validCouponId && appliedCoupon.code) {
                    console.log('🔄 Tìm couponId từ appliedCoupon.code:', appliedCoupon.code);
                    const Coupon = require('../models/coupon');
                    const coupon = await Coupon.findByCode(appliedCoupon.code);
                    if (coupon && coupon._id) {
                        validCouponId = coupon._id.toString();
                        console.log('✅ Tìm thấy couponId:', validCouponId);
                    }
                }
                
                // Kiểm tra validCouponId có hợp lệ không
                if (!validCouponId) {
                    throw new Error('Không thể xác định couponId');
                }
                
                // Đảm bảo validCouponId là string
                if (typeof validCouponId !== 'string') {
                    validCouponId = validCouponId.toString();
                }
                
                console.log('🔄 Gọi Coupon.recordUsage cho COD với:', {
                    couponId: validCouponId,
                    userId: req.session.user._id,
                    orderId: result.insertedId || order._id
                });
                
                await Coupon.recordUsage(validCouponId, req.session.user._id, result.insertedId || order._id);
                console.log('✅ Đã ghi lại việc sử dụng mã giảm giá COD:', appliedCoupon.code);
                
            } catch (couponErr) {
                console.error('❌ Lỗi khi ghi lại việc sử dụng mã giảm giá COD:', couponErr);
                console.error('Chi tiết lỗi:', couponErr.stack);
                console.error('Dữ liệu coupon:', { 
                    couponId, 
                    appliedCoupon, 
                    userId: req.session.user._id, 
                    orderId: result.insertedId || order._id 
                });
                
                // ✅ SỬA LỖI: Thử lại với error handling tốt hơn
                try {
                    console.log('🔄 Thử lại ghi nhận sử dụng mã giảm giá COD...');
                    
                    // Tìm lại coupon từ code
                    const Coupon = require('../models/coupon');
                    const coupon = await Coupon.findByCode(appliedCoupon.code);
                    
                    if (coupon && coupon._id) {
                        const retryValidCouponId = coupon._id.toString();
                        await Coupon.recordUsage(retryValidCouponId, req.session.user._id, result.insertedId || order._id);
                        console.log('✅ Ghi nhận lại thành công với couponId:', retryValidCouponId);
                    } else {
                        throw new Error('Không tìm thấy coupon với code: ' + appliedCoupon.code);
                    }
                    
                } catch (retryErr) {
                    console.error('❌ Vẫn lỗi khi thử lại:', retryErr);
                    // ✅ SỬA LỖI: Không throw error để không làm fail toàn bộ order
                    console.error('⚠️ Đơn hàng đã tạo thành công nhưng không thể ghi nhận sử dụng coupon');
                    
                    // Log chi tiết để debug
                    console.error('Debug info:', {
                        appliedCoupon,
                        originalCouponId: couponId,
                        orderCreated: !!(result.insertedId || order._id),
                        userId: req.session.user._id
                    });
                }
            }
        } else if (appliedCoupon && paymentMethod === 'vnpay') {
            console.log('🔄 VNPay payment - sẽ ghi nhận sử dụng mã giảm giá khi thanh toán thành công');
        } else {
            console.log('❌ KHÔNG GỌI recordUsage - không có appliedCoupon hoặc paymentMethod không hợp lệ');
            console.log('   - appliedCoupon value:', appliedCoupon);
            console.log('   - paymentMethod:', paymentMethod);
            console.log('   - couponId value:', couponId);
        }

        // Xóa giỏ hàng sau khi đặt hàng thành công
        req.cart.clearCart();

        // Gửi email xác nhận đơn hàng (bất đồng bộ)
        if (paymentMethod === 'cod') {
            setImmediate(async () => {
                try {
                    const orderId = result.insertedId || order._id;
                    await sendOrderConfirmation(orderId.toString(), userData);
                    console.log('✅ Order confirmation email sent for COD');
                } catch (emailErr) {
                    console.error('❌ Failed to send order confirmation email:', emailErr);
                }
            });
        }

        // Gửi email thông báo đơn hàng mới cho admin (bất đồng bộ)
        setImmediate(async () => {
            try {
                await sendNewOrderNotification(order, userData);
                console.log('✅ New order notification email sent to admin');
            } catch (emailErr) {
                console.error('❌ Failed to send new order notification email:', emailErr);
            }
        });

        // Lấy order ID từ result
        const orderId = result.insertedId || order._id;
        console.log('🛒 Order result:', result);
        console.log('🛒 Order object _id:', order._id);
        console.log('🛒 Final Order ID:', orderId);
        console.log('🛒 Order ID type:', typeof orderId);
        console.log('🛒 Order ID toString():', orderId.toString());
        
        if (!orderId) {
            throw new Error('Không thể lấy Order ID');
        }
        
        if (paymentMethod === 'vnpay') {
            // Redirect to VNPay payment
            const VNPay = require('../util/vnpay');
            const vnpay = new VNPay();
            const ipAddr = req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                '127.0.0.1';
            
            console.log('🔄 Tạo URL thanh toán VNPay...');
            const paymentUrl = vnpay.createPaymentUrl(
                orderId.toString(),
                totalAmount, // Sử dụng totalAmount đã tính với giảm giá
                `Thanh toán đơn hàng ${orderId}`,
                ipAddr
            );
            console.log('✅ URL thanh toán VNPay đã tạo:', paymentUrl);
            
            return res.json({
                success: true,
                message: 'Đơn hàng đã được tạo thành công. Đang chuyển hướng đến VNPay...',
                redirectUrl: paymentUrl,
                paymentMethod: 'vnpay'
            });
        } else {
            console.log('🛒 COD payment - redirecting to success page');
            // COD payment - redirect to success page
            return res.json({
                success: true,
                message: 'Đơn hàng đã được đặt thành công',
                redirectUrl: `/payment-success/${orderId}`,
                orderData: {
                    orderId: orderId.toString(),
                    totalPrice: totalAmount,
                    discountAmount: discountAmount,
                    appliedCoupon: appliedCoupon
                }
            });
        }
    } catch (err) {
        console.error('🛒 Error in postOrder:', err);
        
        // Xử lý các loại lỗi cụ thể
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: err.message,
                field: err.field || null
            });
        }
        
        if (err.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        
        if (err.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: err.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại sau.'
        });
    }
};

// ===== HÀM KIỂM TRA TỒN KHO =====
async function validateStockForOrder(cartItems) {
    try {
        const Product = require('../models/product');
        const outOfStockItems = [];
        
        for (const item of cartItems) {
            const product = await Product.findById(item.productId);
            
            if (!product) {
                return {
                    valid: false,
                    message: `Sản phẩm "${item.title}" không tồn tại`,
                    outOfStockItems: [item]
                };
            }
            
            if (product.stockQuantity < item.quantity) {
                outOfStockItems.push({
                    ...item,
                    availableStock: product.stockQuantity,
                    requestedQuantity: item.quantity
                });
            }
        }
        
        if (outOfStockItems.length > 0) {
            const itemNames = outOfStockItems.map(item => item.title).join(', ');
            return {
                valid: false,
                message: `Một số sản phẩm không đủ tồn kho: ${itemNames}`,
                outOfStockItems: outOfStockItems
            };
        }
        
        return { valid: true };
    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra tồn kho:', error);
        return {
            valid: false,
            message: 'Có lỗi xảy ra khi kiểm tra tồn kho'
        };
    }
}

// ===== HÀM TẠO ĐƠN HÀNG VỚI RESERVE TỒN KHO =====
async function createOrderWithStockReservation(order, cartItems) {
    const db = require('../util/database').getDb();
    const session = db.client.startSession();
    
    try {
        let orderResult;
        
        await session.withTransaction(async () => {
            // Kiểm tra lại tồn kho trong transaction
            for (const item of cartItems) {
                const product = await db.collection('products').findOne(
                    { _id: new mongodb.ObjectId(item.productId) },
                    { session }
                );
                
                if (!product) {
                    throw new Error(`Sản phẩm "${item.title}" không tồn tại`);
                }
                
                if (product.stockQuantity < item.quantity) {
                    throw new Error(`Sản phẩm "${item.title}" chỉ còn ${product.stockQuantity} trong kho`);
                }
            }
            
            // Tạo đơn hàng trong transaction
            orderResult = await order.save();
            console.log('🛒 Order created in transaction:', orderResult);
            
            // Giảm tồn kho ngay lập tức
            for (const item of cartItems) {
                await db.collection('products').updateOne(
                    { _id: new mongodb.ObjectId(item.productId) },
                    { 
                        $inc: { stockQuantity: -item.quantity },
                        $set: { updatedAt: new Date() }
                    },
                    { session }
                );
            }
        });
        
        return orderResult;
        
    } catch (error) {
        console.error('❌ Lỗi trong transaction:', error);
        throw error;
    } finally {
        await session.endSession();
    }
}

exports.getOrders = async (req, res, next) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/auth/login');
        }

        const orders = await Order.findByUserId(req.session.user._id);

        res.render('shop/orders', {
            path: '/auth/orders',
            pageTitle: 'Đơn hàng của bạn',
            orders: orders,
            success: req.query.success || null,
            error: req.query.error || null,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart ? req.cart.getItemCount() : 0
        });
    } catch (err) {
        console.error('Lỗi khi tải đơn hàng:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể tải danh sách đơn hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getOrderDetail = async (req, res, next) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/auth/login');
        }

        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy',
                path: '/error',
                message: 'Không tìm thấy đơn hàng',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // Kiểm tra quyền truy cập
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).render('error/403', {
                pageTitle: 'Không có quyền',
                path: '/error',
                message: 'Bạn không có quyền xem đơn hàng này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        res.render('shop/order-detail', {
            path: '/auth/orders',
            pageTitle: `Chi tiết đơn hàng #${order._id.toString().slice(-8)}`,
            order: order,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart ? req.cart.getItemCount() : 0
        });
    } catch (err) {
        console.error('Lỗi khi tải chi tiết đơn hàng:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể tải chi tiết đơn hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.getDownloadInvoice = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).send('Không tìm thấy đơn hàng');
        }

        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).send('Bạn không có quyền tải hóa đơn này');
        }

        const invoiceName = `order-${orderId}-${moment().format('YYYYMMDD')}.pdf`;
        const invoicePath = path.join('data', 'pdfs', invoiceName);

        // Kiểm tra xem file PDF đã tồn tại chưa
        if (!fs.existsSync(invoicePath)) {
            // Tạo PDF mới nếu chưa tồn tại
            const user = await User.findById(userId);
            await generateOrderPDF(order, user);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);

        const file = fs.createReadStream(invoicePath);
        file.pipe(res);
    } catch (err) {
        console.error('Lỗi khi tải hóa đơn:', err);
        res.status(500).send('Lỗi khi tải hóa đơn');
    }
};

exports.getAbout = (req, res, next) => {
    res.render('shop/about', {
        pageTitle: 'Giới thiệu | PetShop',
        path: '/about',
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
    });
};

exports.getContact = (req, res, next) => {
    res.render('shop/contact', {
        pageTitle: 'Liên hệ | PetShop',
        path: '/contact',
        isAuthenticated: req.session.user ? true : false,
        isAdmin: req.session.user && req.session.user.role === 'admin',
        user: req.session.user || null
    });
};

// Trang thành công COD
exports.getPaymentSuccess = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        // Tìm đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy',
                path: '/error',
                message: 'Không tìm thấy đơn hàng',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // Kiểm tra quyền truy cập
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).render('error/403', {
                pageTitle: 'Không có quyền',
                path: '/error',
                message: 'Bạn không có quyền xem đơn hàng này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        res.render('shop/payment-success', {
            pageTitle: 'Đặt hàng thành công',
            path: '/payment-success',
            orderId: orderId,
            order: order,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart ? req.cart.getItemCount() : 0
        });
    } catch (err) {
        console.error('Lỗi khi tải trang thành công:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Error',
            path: '/error',
            message: 'Không thể tải trang thành công',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.postContact = async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body;

        // Tạo transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Gửi email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Gửi đến chính mình
            subject: `[PetShop Contact] ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 0;">
                  <div style="background: linear-gradient(90deg, #56ccf2 0%, #2f80ed 100%); color: #fff; padding: 32px 24px 20px 24px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">📩 Liên hệ mới từ website Pet Store</h2>
                    <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Bạn vừa nhận được một tin nhắn liên hệ mới</p>
                  </div>
                  <div style="background: #fff; border-radius: 0 0 16px 16px; box-shadow: 0 2px 8px rgba(44,62,80,0.07); padding: 32px 24px;">
                    <div style="margin-bottom: 24px;">
                      <h3 style="color: #2f80ed; margin: 0 0 12px 0; font-size: 20px;">Thông tin liên hệ</h3>
                      <div style="background: #f1f5f9; border-radius: 8px; padding: 18px 20px;">
                        <p style="margin: 0 0 8px 0;"><strong>👤 Họ tên:</strong> <span style="color: #222;">${name}</span></p>
                        <p style="margin: 0 0 8px 0;"><strong>✉️ Email:</strong> <a href="mailto:${email}" style="color: #2f80ed; text-decoration: underline;">${email}</a></p>
                        <p style="margin: 0 0 8px 0;"><strong>🏷️ Chủ đề:</strong> <span style="color: #222;">${subject}</span></p>
                      </div>
                    </div>
                    <div>
                      <h3 style="color: #2f80ed; margin: 0 0 12px 0; font-size: 20px;">Nội dung liên hệ</h3>
                      <div style="background: #f9fafb; border-radius: 8px; padding: 18px 20px; color: #333; font-size: 16px; line-height: 1.7;">
                        ${message.replace(/\n/g, '<br>')}
                      </div>
                    </div>
                    <div style="margin-top: 32px; text-align: center; color: #888; font-size: 13px;">
                      <hr style="margin-bottom: 16px; border: none; border-top: 1px solid #e0e7ef;">
                      <p style="margin: 0;">Email này được gửi tự động từ website Pet Store.<br>Vui lòng không trả lời trực tiếp email này.</p>
                    </div>
                  </div>
                </div>
            `
        });

        res.render('shop/contact', {
            pageTitle: 'Liên hệ | PetShop',
            path: '/contact',
            success: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi gửi email liên hệ:', err);
        res.render('shop/contact', {
            pageTitle: 'Liên hệ | PetShop',
            path: '/contact',
            message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.getSearch = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const sort = req.query.sort || '';

        // Build filter object
        let filter = {};
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) {
            filter.category = category;
        }

        // Lấy danh mục cho navigation
        const categories = await Category.find();

        // Lấy tất cả sản phẩm phù hợp filter
        let products = await Product.find(filter);

        // Sắp xếp thủ công
        switch (sort) {
            case 'price_asc':
                products = products.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price_desc':
                products = products.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'name_asc':
                products = products.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'name_desc':
                products = products.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                break;
            case 'rating_desc':
                products = products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            default:
                products = products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        // Phân trang thủ công
        const totalProducts = products.length;
        const totalPages = Math.ceil(totalProducts / limit);
        products = products.slice(skip, skip + limit);

        // Lấy số lượng sản phẩm trong giỏ hàng
        let cartCount = 0;
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && userData.cart && Array.isArray(userData.cart.items)) {
                cartCount = userData.cart.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        }

        let favorites = [];
        if (req.session.user && req.session.user._id) {
            const userData = await User.findById(req.session.user._id);
            if (userData && Array.isArray(userData.favorites)) {
                favorites = userData.favorites.map(id => id.toString());
            }
        }

        res.render('shop/search', {
            products: products,
            pageTitle: `Kết quả tìm kiếm: ${search} | PetShop`,
            path: '/search',
            currentPage: page,
            totalPages: totalPages,
            totalProducts: totalProducts,
            search: search,
            category: category,
            sort: sort,
            hasProducts: products.length > 0,
            activeShop: true,
            productCSS: true,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount,
            favorites,
            categories
        });
    } catch (err) {
        console.error('Lỗi khi tìm kiếm sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi | PetShop',
            path: '/error',
            message: 'Không thể tìm kiếm sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.cancelOrder = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user && req.session.user._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
        }
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
        
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này' });
        }
        
        // Cho phép hủy đơn hàng ở các trạng thái: pending, confirmed, paid
        if (!['pending', 'confirmed', 'paid'].includes(order.status)) {
            const statusText = {
                'processing': 'đang xử lý',
                'shipped': 'đã giao',
                'delivered': 'đã hoàn thành',
                'cancelled': 'đã hủy'
            };
            return res.status(400).json({ 
                success: false, 
                message: `Không thể hủy đơn hàng ở trạng thái "${statusText[order.status] || order.status}"!` 
            });
        }

        // Hoàn lại tồn kho cho các sản phẩm trong đơn hàng
        try {
            if (order.items && order.items.length > 0) {
                const Product = require('../models/product');
                await Product.restoreStockForOrder(order.items);
                console.log('✅ Đã hoàn lại tồn kho cho đơn hàng bị hủy:', orderId);
            }
        } catch (stockError) {
            console.error('❌ Lỗi khi hoàn lại tồn kho:', stockError);
            // Không dừng quá trình hủy đơn hàng nếu lỗi hoàn tồn kho
        }

        // Cập nhật trạng thái đơn hàng thành 'cancelled'
        await Order.updateStatus(orderId, 'cancelled');

        // Ghi log cho đơn hàng đã thanh toán VNPay
        if (order.paymentMethod === 'vnpay' && order.paymentStatus === 'paid') {
            console.log('⚠️ Đơn hàng VNPay đã thanh toán bị hủy:', orderId);
            console.log('💰 Cần xử lý hoàn tiền cho khách hàng');
            // TODO: Tích hợp API hoàn tiền VNPay nếu cần
        }

        // Kiểm tra nếu là AJAX request
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.json({ success: true, message: 'Đã hủy đơn hàng thành công' });
        } else {
            res.redirect('/auth/orders');
        }
    } catch (err) {
        console.error('Lỗi hủy đơn hàng:', err);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.status(500).json({ success: false, message: 'Lỗi khi hủy đơn hàng: ' + err.message });
        } else {
            res.status(500).send('Lỗi khi hủy đơn hàng');
        }
    }
};

// Toggle favorite - thêm/xóa yêu thích
exports.toggleFavorite = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;
        
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Thiếu productId' });
        }

        console.log('🔍 DEBUG toggleFavorite - User ID:', userId);
        console.log('🔍 DEBUG toggleFavorite - Product ID:', productId);

        const userData = await User.findById(userId);
        if (!userData) {
            console.error('🔍 DEBUG toggleFavorite - Không tìm thấy user');
            return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
        }

        console.log('🔍 DEBUG toggleFavorite - User data found:', userData.name);

        // Tạo User object với _id
        const user = new User(userData.name, userData.email, userData.role, userData.favorites || []);
        user._id = userData._id; // Đảm bảo _id được set

        console.log('🔍 DEBUG toggleFavorite - User object created with _id:', user._id);
        
        // Kiểm tra xem sản phẩm đã có trong favorites chưa
        const isCurrentlyFavorited = userData.favorites && userData.favorites.some(id => {
            try {
                return id.toString() === productId.toString();
            } catch (e) {
                return false;
            }
        });
        
        console.log('🔍 DEBUG toggleFavorite - Is currently favorited:', isCurrentlyFavorited);
        
        if (isCurrentlyFavorited) {
            // Xóa khỏi favorites
            console.log('🔍 DEBUG toggleFavorite - Removing from favorites');
            await user.removeFavorite(productId);
        } else {
            // Thêm vào favorites
            console.log('🔍 DEBUG toggleFavorite - Adding to favorites');
            await user.addFavorite(productId);
        }

        // Lấy lại số lượng yêu thích mới từ database
        const updatedUser = await User.findById(userId);
        const favoritesCount = updatedUser.favorites ? updatedUser.favorites.length : 0;

        // Cập nhật session user để đồng bộ
        req.session.user.favorites = updatedUser.favorites;

        console.log('🔍 DEBUG toggleFavorite - Updated favorites count:', favoritesCount);
        console.log('🔍 DEBUG toggleFavorite - Updated favorites:', updatedUser.favorites);

        res.json({ 
            success: true, 
            favoritesCount,
            isFavorite: !isCurrentlyFavorited // Trạng thái mới
        });
    } catch (err) {
        console.error('🔍 DEBUG toggleFavorite - Error:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi thay đổi trạng thái yêu thích: ' + err.message });
    }
};

// Thêm sản phẩm vào danh sách yêu thích
exports.addFavorite = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;
        const userData = await User.findById(userId);
        if (!userData) return res.status(404).json({ success: false, message: 'Không tìm thấy user' });

        const user = new User(userData.name, userData.email, userData.role, userData.favorites || []);
        user._id = userData._id;
        await user.addFavorite(productId);

        // Lấy lại số lượng yêu thích mới từ database
        const updatedUser = await User.findById(userId);
        const favoritesCount = updatedUser.favorites ? updatedUser.favorites.length : 0;

        // Cập nhật session user để đồng bộ
        req.session.user.favorites = updatedUser.favorites;

        console.log('🔍 DEBUG addFavorite - Updated favorites count:', favoritesCount);
        console.log('🔍 DEBUG addFavorite - Updated favorites:', updatedUser.favorites);

        res.json({ success: true, favoritesCount });
    } catch (err) {
        console.error('Lỗi khi thêm vào yêu thích:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi thêm vào yêu thích' });
    }
};

// Xóa tất cả sản phẩm khỏi danh sách yêu thích
exports.deleteAllFavorites = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
            }
            return res.redirect('/auth/login');
        }

        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        if (!userData) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
            }
            return res.redirect('/favorites');
        }

        console.log('🔍 DEBUG deleteAllFavorites - User ID:', userId);
        console.log('🔍 DEBUG deleteAllFavorites - User data found:', !!userData);
        console.log('🔍 DEBUG deleteAllFavorites - Current favorites count:', userData.favorites ? userData.favorites.length : 0);

        const user = new User(userData.name, userData.email, userData.role, []);
        user._id = userData._id;
        await user.clearFavorites();

        // Cập nhật session user
        req.session.user.favorites = [];

        console.log('🔍 DEBUG deleteAllFavorites - All favorites cleared');
        console.log('🔍 DEBUG deleteAllFavorites - Session updated');

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.json({ success: true, favoritesCount: 0 });
        } else {
            res.redirect('/favorites');
        }
    } catch (err) {
        console.error('Lỗi khi xóa tất cả yêu thích:', err);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.status(500).json({ success: false, message: 'Lỗi khi xóa tất cả yêu thích' });
        } else {
            res.redirect('/favorites');
        }
    }
};

// Xóa sản phẩm khỏi danh sách yêu thích
exports.removeFavorite = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            // Kiểm tra nếu là AJAX request
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
            }
            return res.redirect('/auth/login');
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;
        const userData = await User.findById(userId);
        if (!userData) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
            }
            return res.redirect('/favorites');
        }

        const user = new User(userData.name, userData.email, userData.role, userData.favorites || []);
        user._id = userData._id;
        await user.removeFavorite(productId);

        // Lấy lại số lượng yêu thích mới từ database
        const updatedUser = await User.findById(userId);
        const favoritesCount = updatedUser.favorites ? updatedUser.favorites.length : 0;

        // Cập nhật session user để đồng bộ
        req.session.user.favorites = updatedUser.favorites;

        console.log('🔍 DEBUG removeFavorite - Updated favorites count:', favoritesCount);
        console.log('🔍 DEBUG removeFavorite - Updated favorites:', updatedUser.favorites);

        // Kiểm tra nếu là AJAX request
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.json({ success: true, favoritesCount });
        } else {
            // Redirect về trang favorites nếu không phải AJAX
            res.redirect('/favorites');
        }
    } catch (err) {
        console.error('Lỗi khi xóa khỏi yêu thích:', err);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.status(500).json({ success: false, message: 'Lỗi khi xóa khỏi yêu thích' });
        } else {
            res.redirect('/favorites');
        }
    }
};

// Lấy danh sách sản phẩm yêu thích
exports.getFavorites = async (req, res) => {
    try {
        console.log('🔍 DEBUG: Bắt đầu getFavorites');

        if (!req.session.user || !req.session.user._id) {
            console.log('🔍 DEBUG: User chưa đăng nhập');
            return res.render('shop/favorites', {
                products: [],
                pageTitle: 'Sản phẩm yêu thích',
                path: '/favorites',
                isAuthenticated: false,
                isAdmin: false,
                user: null,
                cartCount: req.cart.getItemCount()
            });
        }

        const userId = req.session.user._id;
        console.log('🔍 DEBUG: User ID:', userId);

        const userData = await User.findById(userId);
        console.log('🔍 DEBUG: User data:', userData ? 'Found' : 'Not found');

        if (!userData) {
            console.log('🔍 DEBUG: Không tìm thấy user data');
            return res.render('shop/favorites', {
                products: [],
                pageTitle: 'Sản phẩm yêu thích',
                path: '/favorites',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null,
                cartCount: req.cart.getItemCount()
            });
        }

        const favorites = userData.favorites || [];
        console.log('🔍 DEBUG Favorites - Raw favorites from DB:', favorites);
        console.log('🔍 DEBUG Favorites - Count from DB:', favorites.length);
        console.log('🔍 DEBUG Favorites - Type of favorites:', typeof favorites);
        console.log('🔍 DEBUG Favorites - Is array:', Array.isArray(favorites));

        if (favorites.length === 0) {
            console.log('🔍 DEBUG: Không có favorites nào');
            return res.render('shop/favorites', {
                products: [],
                pageTitle: 'Sản phẩm yêu thích',
                path: '/favorites',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null,
                cartCount: req.cart.getItemCount()
            });
        }

        // Thử cách khác để tìm sản phẩm
        console.log('🔍 DEBUG: Đang tìm sản phẩm...');

        // Cách 1: Sử dụng Product.find()
        let products = [];
        try {
            products = await Product.find({ _id: { $in: favorites } });
            console.log('🔍 DEBUG Favorites - Products found (method 1):', products.length);
        } catch (err) {
            console.error('🔍 DEBUG: Lỗi khi dùng Product.find():', err);
        }

        // Cách 2: Nếu cách 1 không hoạt động, thử trực tiếp với database
        if (products.length === 0) {
            try {
                const { getDb } = require('../util/database');
                const db = getDb();
                const mongodb = require('mongodb');

                // Chuyển đổi favorites thành ObjectId
                const objectIds = favorites.map(id => {
                    try {
                        return new mongodb.ObjectId(id);
                    } catch (err) {
                        console.error('🔍 DEBUG: Invalid ObjectId:', id);
                        return null;
                    }
                }).filter(id => id !== null);

                console.log('🔍 DEBUG: ObjectIds to search:', objectIds);

                products = await db.collection('products')
                    .find({ _id: { $in: objectIds } })
                    .toArray();

                console.log('🔍 DEBUG Favorites - Products found (method 2):', products.length);
            } catch (err) {
                console.error('🔍 DEBUG: Lỗi khi dùng database trực tiếp:', err);
            }
        }

        console.log('🔍 DEBUG Favorites - Final products:', products.length);
        if (products.length > 0) {
            console.log('🔍 DEBUG Favorites - Product titles:', products.map(p => p.title));
        }

        // Kiểm tra favorites có sản phẩm không tồn tại
        const existingProductIds = products.map(p => p._id.toString());
        const missingProductIds = favorites.filter(fav => !existingProductIds.includes(fav.toString()));
        if (missingProductIds.length > 0) {
            console.log('⚠️ WARNING: Missing products in favorites:', missingProductIds);
        }

        res.render('shop/favorites', {
            products,
            pageTitle: 'Sản phẩm yêu thích',
            path: '/favorites',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart.getItemCount()
        });
    } catch (err) {
        console.error('🔍 DEBUG: Lỗi trong getFavorites:', err);
        res.render('shop/favorites', {
            products: [],
            pageTitle: 'Sản phẩm yêu thích',
            path: '/favorites',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            cartCount: req.cart.getItemCount()
        });
    }
};

// Trang thanh toán
exports.getCheckout = async (req, res, next) => {
    try {
        // Kiểm tra nếu user là admin thì redirect đến trang quản lý đơn hàng
        if (req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/admin/orders');
        }
        
        const userId = req.session.user ? req.session.user._id : null;
        let user = null;
        let cart = [];
        let totalPrice = 0;

        // Lấy giỏ hàng từ session cart (dùng cho cả user và guest)
        const sessionCart = req.cart.getCart();
        cart = sessionCart.items || [];
        totalPrice = sessionCart.totalPrice || 0;

        // Tính phí vận chuyển cho trang checkout
        const shippingCalculator = require('../util/shipping-calculator');
        const shippingInfo = shippingCalculator.calculateShippingFee(totalPrice);

        res.render('shop/checkout', {
            pageTitle: 'Thanh toán',
            path: '/checkout',
            cart: cart,
            totalPrice: totalPrice,
            shippingInfo: shippingInfo,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null,
            calculateShippingFee: (totalPrice) => shippingCalculator.calculateShippingFee(totalPrice),
            calculateTotalAmount: (totalPrice, shippingFee) => shippingCalculator.calculateTotalAmount(totalPrice, 0).total,
            formatCurrency: (amount) => new Intl.NumberFormat('vi-VN').format(amount)
        });
    } catch (err) {
        console.error('Lỗi khi tải trang thanh toán:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải trang thanh toán',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

// Xóa đơn hàng
exports.deleteOrder = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user && req.session.user._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        // Kiểm tra quyền xóa đơn hàng
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa đơn hàng này' });
        }

        // Chỉ cho phép xóa đơn hàng đã hủy hoặc đã hoàn thành
        if (order.status !== 'cancelled' && order.status !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể xóa đơn hàng đã hủy hoặc đã hoàn thành' });
        }

        await Order.deleteById(orderId);
        res.json({ success: true, message: 'Đã xóa đơn hàng thành công' });
    } catch (err) {
        console.error('Lỗi khi xóa đơn hàng:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa đơn hàng' });
    }
};

// Xóa tất cả đơn hàng
exports.deleteAllOrders = async (req, res, next) => {
    try {
        const userId = req.session.user && req.session.user._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
        }

        // Chỉ xóa các đơn hàng đã hủy hoặc đã hoàn thành của user
        const orders = await Order.findByUserId(userId);
        const deletableOrders = orders.filter(order =>
            order.status === 'cancelled' || order.status === 'delivered'
        );

        if (deletableOrders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có đơn hàng nào có thể xóa (chỉ xóa được đơn hàng đã hủy hoặc đã hoàn thành)'
            });
        }

        // Xóa từng đơn hàng
        for (const order of deletableOrders) {
            await Order.deleteById(order._id);
        }

        res.json({
            success: true,
            message: `Đã xóa ${deletableOrders.length} đơn hàng thành công`
        });
    } catch (err) {
        console.error('Lỗi khi xóa tất cả đơn hàng:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa đơn hàng' });
    }
};
// Thêm function để dọn dẹp favorites
exports.cleanupFavorites = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = await User.findById(userId);
        if (!userData || !userData.favorites) {
            return res.json({ success: true, message: 'Không có favorites để dọn dẹp' });
        }

        const favorites = userData.favorites;
        const existingProducts = await Product.find({ _id: { $in: favorites } });
        const existingProductIds = existingProducts.map(p => p._id.toString());

        // Lọc ra những favorites có sản phẩm tồn tại
        const cleanedFavorites = favorites.filter(fav => existingProductIds.includes(fav.toString()));

        if (cleanedFavorites.length !== favorites.length) {
            // Cập nhật favorites đã được dọn dẹp
            await User.updateOne(
                { _id: userId },
                { $set: { favorites: cleanedFavorites } }
            );

            res.json({
                success: true,
                message: `Đã dọn dẹp ${favorites.length - cleanedFavorites.length} sản phẩm không tồn tại khỏi favorites`,
                oldCount: favorites.length,
                newCount: cleanedFavorites.length
            });
        } else {
            res.json({ success: true, message: 'Favorites đã sạch, không cần dọn dẹp' });
        }
    } catch (err) {
        console.error('Lỗi khi dọn dẹp favorites:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi dọn dẹp favorites' });
    }
};

exports.submitReview = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để gửi đánh giá'
            });
        }

        const { productId, serviceId, rating, comment } = req.body;

        // ===== VALIDATION DỮ LIỆU ĐẦU VÀO =====
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating phải từ 1-5 sao'
            });
        }

        if (!comment || comment.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung đánh giá phải có ít nhất 10 ký tự'
            });
        }

        if (comment.trim().length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung đánh giá không được quá 1000 ký tự'
            });
        }

        if (!productId && !serviceId) {
            return res.status(400).json({
                success: false,
                message: 'Phải có productId hoặc serviceId'
            });
        }

        if (productId && serviceId) {
            return res.status(400).json({
                success: false,
                message: 'Không thể đánh giá cả sản phẩm và dịch vụ cùng lúc'
            });
        }

        // ===== KIỂM TRA SẢN PHẨM/DỊCH VỤ TỒN TẠI =====
        if (productId) {
            const Product = require('../models/product');
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Sản phẩm không tồn tại'
                });
            }
        }

        if (serviceId) {
            const Service = require('../models/service');
            const service = await Service.findById(serviceId);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Dịch vụ không tồn tại'
                });
            }
        }

        // ===== KIỂM TRA USER ĐÃ ĐÁNH GIÁ CHƯA =====
        const Review = require('../models/review');
        const existingReview = await Review.checkUserReviewExists(
            req.session.user._id,
            productId,
            serviceId
        );

        if (existingReview.exists) {
            return res.status(409).json({
                success: false,
                message: 'Bạn đã đánh giá sản phẩm/dịch vụ này rồi'
            });
        }

        // ===== KIỂM TRA RATE LIMITING =====
        const rateLimit = await Review.checkRateLimit(req.session.user._id);
        if (!rateLimit.allowed) {
            return res.status(429).json({
                success: false,
                message: `Bạn đã đánh giá ${rateLimit.totalToday} lần hôm nay. Giới hạn 5 đánh giá/ngày.`
            });
        }

        // ===== TẠO REVIEW MỚI =====
        const review = new Review(
            req.session.user._id,
            productId,
            serviceId,
            rating,
            comment
        );

        await review.save();

        // ===== GỬI EMAIL THÔNG BÁO CHO ADMIN =====
        try {
            const { sendEmail } = require('../util/email');
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'admin@petstore.com',
                subject: 'Đánh giá mới cần duyệt',
                template: 'new-review-notification',
                data: {
                    userName: req.session.user.name,
                    rating: rating,
                    comment: comment,
                    itemType: productId ? 'sản phẩm' : 'dịch vụ',
                    itemId: productId || serviceId
                }
            });
        } catch (emailErr) {
            console.error('Lỗi khi gửi email thông báo đánh giá mới:', emailErr);
            // Không trả về lỗi cho user, chỉ log
        }

        res.json({
            success: true,
            message: 'Đánh giá của bạn đã được gửi thành công và đang chờ duyệt!',
            reviewId: review._id,
            remainingReviews: rateLimit.remaining - 1
        });

    } catch (err) {
        console.error('Lỗi khi submit review:', err);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.'
        });
    }
};

exports.getProductReviews = async (req, res, next) => {
    try {
        // Tắt cache để luôn trả về dữ liệu mới
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
        const productId = req.params.productId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.session.user ? req.session.user._id : null;

        // Điều kiện lọc: lấy đánh giá đã được duyệt HOẶC đánh giá của người dùng hiện tại
        let filter = {
            productId: productId,
            $or: [
                { status: 'approved' },
                { userId: userId, status: { $ne: 'rejected' } } // Hiển thị cả pending cho user hiện tại
            ]
        };

        if (!userId) {
            // Nếu không đăng nhập, chỉ lấy đánh giá đã duyệt
            filter = {
                productId: productId,
                status: 'approved'
            };
        }

        const reviewsData = await Review.fetchAll(page, limit, filter);

        // Lấy thông tin user cho mỗi review
        const reviewsWithUser = await Promise.all(
            reviewsData.reviews.map(async (review) => {
                const user = await User.findById(review.userId);
                return {
                    ...review,
                    userName: user ? user.name : 'Khách hàng',
                    userAvatar: user ? user.avatar : null,
                    isCurrentUserReview: review.userId === userId,
                    isPending: review.status === 'pending',
                    // Thêm các trường phản hồi admin
                    adminReply: review.adminReply,
                    adminReplyDate: review.adminReplyDate
                };
            })
        );

        res.json({
            success: true,
            reviews: reviewsWithUser,
            total: reviewsData.total,
            totalPages: reviewsData.totalPages,
            currentPage: page
        });


    } catch (err) {
        console.error('Lỗi khi lấy đánh giá sản phẩm:', err);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi tải đánh giá'
        });
    }
};