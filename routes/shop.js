const path = require('path');
const fs = require('fs');

const express = require('express');

const rootDir = require('../util/path');

const products = require('./admin').products;

const shopController = require('../controllers/shop');


const { sendOrderConfirmation } = require('../util/email');
const User = require('../models/user');
const isAuth = require('../middleware/is-auth');
const cartMiddleware = require('../middleware/cart');
const { getDb } = require('../util/database');

const router = express.Router();

// Route tạo và đăng nhập user mặc định
router.get('/create-default-user', async (req, res, next) => {
    try {
        // Kiểm tra xem user đã tồn tại chưa
        let user = await User.findByEmail('default@example.com');

        if (!user) {
            // Tạo user mới nếu chưa tồn tại
            const newUser = new User('Default User', 'default@example.com');
            newUser.role = 'admin'; // Set role là admin
            const result = await newUser.save();

            if (!result.insertedId) {
                throw new Error('Không thể tạo user mới - không có insertedId');
            }

            user = await User.findById(result.insertedId);
            if (!user) {
                throw new Error('Không thể tìm thấy user sau khi tạo');
            }

            console.log('Đã tạo user mới:', user);
        }

        // Lưu user vào session
        req.session.user = {
            _id: user._id.toString(),
            email: user.email,
            role: user.role || 'admin'
        };

        await req.session.save();
        console.log('Session user:', req.session.user);

        // Redirect về trang admin nếu user là admin, ngược lại về trang chủ
        if (user.role === 'admin') {
            return res.redirect('/admin/products');
        } else {
            return res.redirect('/');
        }
    } catch (err) {
        console.error('Lỗi khi tạo/đăng nhập user:', err);
        return res.status(500).json({
            message: 'Không thể tạo/đăng nhập user',
            details: err.message
        });
    }
});

// Trang chủ
router.get('/', shopController.getIndex);

// Danh sách sản phẩm
router.get('/products', shopController.getProducts);

// Chi tiết sản phẩm
router.get('/products/:productId', shopController.getProduct);

// Giỏ hàng - không cần đăng nhập
router.get('/cart', shopController.getCart);
router.post('/cart', shopController.postCart);
router.post('/cart/add', shopController.postCart); // AJAX endpoint
router.post('/cart-delete-item', shopController.postCartDeleteProduct);
router.post('/cart-delete-all', shopController.postCartDeleteAll);
router.post('/cart-update-quantity', shopController.postCartUpdateQuantity);

// Đơn hàng - cần đăng nhập
router.post('/orders', isAuth, cartMiddleware, shopController.postOrder);
// Xóa các route này từ shop.js
// router.get('/orders', isAuth, shopController.getOrders);
// router.get('/orders/:orderId', isAuth, shopController.getOrderDetail);
// router.post('/orders/:orderId/delete', shopController.deleteOrder);
// router.post('/orders/delete-all', shopController.deleteAllOrders);
// router.post('/orders/:orderId/cancel', isAuth, shopController.cancelOrder);
// router.get('/download-invoice/:orderId', isAuth, shopController.getDownloadInvoice);

router.get('/checkout', shopController.getCheckout);

// Route trang thành công COD
router.get('/payment-success/:orderId', isAuth, cartMiddleware, shopController.getPaymentSuccess);

router.get('/search', shopController.getSearch);

// Xóa dòng này: router.get('/categories', shopController.getCategories);

router.get('/about', shopController.getAbout);
router.get('/contact', shopController.getContact);
router.post('/contact', shopController.postContact);

// Yêu thích sản phẩm
router.post('/favorites/toggle', isAuth, shopController.toggleFavorite); // Route toggle phải đặt trước
// Thêm route GET để trả về thông báo hợp lý nếu truy cập nhầm bằng GET
router.get('/favorites/toggle', (req, res) => {
  res.status(405).send('Vui lòng sử dụng phương thức POST để thay đổi trạng thái yêu thích.');
});
router.delete('/favorites', isAuth, shopController.deleteAllFavorites);
router.get('/favorites', isAuth, shopController.getFavorites);
router.post('/favorites/cleanup', isAuth, shopController.cleanupFavorites);
router.post('/favorites/:productId', isAuth, shopController.addFavorite);
router.delete('/favorites/:productId', isAuth, shopController.removeFavorite);

// Route debug để kiểm tra favorites
router.get('/debug/favorites', isAuth, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const User = require('../models/user');
        const Product = require('../models/product');
        const { getDb } = require('../util/database');
        
        // Lấy user data
        const userData = await User.findById(userId);
        const favorites = userData ? userData.favorites || [] : [];
        
        // Lấy tất cả sản phẩm
        const allProducts = await Product.fetchAll();
        
        // Lấy sản phẩm favorites
        const favoriteProducts = favorites.length > 0 ? await Product.find({ _id: { $in: favorites } }) : [];
        
        res.json({
            userId,
            favoritesCount: favorites.length,
            favorites,
            allProductsCount: allProducts.length,
            favoriteProductsCount: favoriteProducts.length,
            favoriteProducts: favoriteProducts.map(p => ({ id: p._id, title: p.title }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Routes cho đánh giá sản phẩm
router.post('/reviews/submit', isAuth, shopController.submitReview);
router.get('/reviews/:productId', shopController.getProductReviews);

// Route để validate mã giảm giá
router.post('/validate-coupon', async (req, res) => {
    try {
        const { couponCode, orderValue } = req.body;
        
        if (!couponCode) {
            return res.json({
                valid: false,
                message: 'Vui lòng nhập mã giảm giá'
            });
        }

        const Coupon = require('../models/coupon');
        const result = await Coupon.validateCoupon(couponCode, parseFloat(orderValue) || 0);
        
        res.json(result);
    } catch (error) {
        console.error('Lỗi khi validate mã giảm giá:', error);
        res.status(500).json({
            valid: false,
            message: 'Có lỗi xảy ra khi kiểm tra mã giảm giá'
        });
    }
});

// Route để kiểm tra tồn kho real-time
router.post('/check-stock', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        
        if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ'
            });
        }
        
        const Product = require('../models/product');
        const stockInfo = await Product.checkStockAvailability(productId, quantity);
        
        res.json({
            success: true,
            available: stockInfo.available,
            currentStock: stockInfo.currentStock,
            requestedQuantity: quantity,
            message: stockInfo.message
        });
    } catch (error) {
        console.error('Lỗi khi kiểm tra tồn kho:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi kiểm tra tồn kho'
        });
    }
});

// Route để kiểm tra trạng thái đơn hàng
router.get('/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để xem trạng thái đơn hàng'
            });
        }
        
        const Order = require('../models/order');
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }
        
        // Kiểm tra quyền xem đơn hàng
        if (order.userId.toString() !== req.session.user._id.toString() && 
            req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem đơn hàng này'
            });
        }
        
        res.json({
            success: true,
            order: {
                _id: order._id,
                status: order.status,
                paymentStatus: order.paymentStatus,
                totalPrice: order.totalPrice,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                shippingInfo: order.shippingInfo
            }
        });
    } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái đơn hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi kiểm tra trạng thái đơn hàng'
        });
    }
});

// Route để lấy thông tin tồn kho của giỏ hàng
router.post('/check-cart-stock', async (req, res) => {
    try {
        const { cartItems } = req.body;
        
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.json({
                success: false,
                message: 'Giỏ hàng trống'
            });
        }

        const Product = require('../models/product');
        const stockChecks = [];
        let hasOutOfStock = false;

        for (const item of cartItems) {
            const stockCheck = await Product.checkStockAvailability(item.productId, item.quantity);
            stockChecks.push({
                productId: item.productId,
                title: item.title,
                requestedQuantity: item.quantity,
                ...stockCheck
            });
            
            if (!stockCheck.available) {
                hasOutOfStock = true;
            }
        }

        res.json({
            success: true,
            valid: !hasOutOfStock,
            items: stockChecks,
            message: hasOutOfStock ? 'Một số sản phẩm không đủ tồn kho' : 'Tất cả sản phẩm đều có đủ tồn kho'
        });
    } catch (error) {
        console.error('Lỗi khi kiểm tra tồn kho giỏ hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi kiểm tra tồn kho'
        });
    }
});

// Route để test mã giảm giá
router.get('/test-coupon', (req, res) => {
    res.sendFile(path.join(__dirname, '../test-coupon.html'));
});

// Route để test API mã giảm giá
router.get('/test-api', (req, res) => {
    res.sendFile(path.join(__dirname, '../test-api.html'));
});

// Route tính phí vận chuyển
router.post('/calculate-shipping', async (req, res) => {
    try {
        const { orderValue } = req.body;
        
        if (!orderValue || isNaN(orderValue)) {
            return res.status(400).json({
                success: false,
                message: 'Giá trị đơn hàng không hợp lệ'
            });
        }

        const shippingCalculator = require('../util/shipping-calculator');
        const shippingInfo = shippingCalculator.calculateShippingFee(parseFloat(orderValue));
        const nextTierInfo = shippingCalculator.getNextTierInfo(parseFloat(orderValue));

        res.json({
            success: true,
            shippingInfo: shippingInfo,
            nextTierInfo: nextTierInfo,
            totalAmount: parseFloat(orderValue) + shippingInfo.fee
        });
    } catch (error) {
        console.error('Lỗi khi tính phí vận chuyển:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi tính phí vận chuyển'
        });
    }
});

module.exports = router;
