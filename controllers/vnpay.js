const VNPay = require('../util/vnpay');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');
const { sendEmail, sendOrderConfirmation } = require('../util/email');

const vnpay = new VNPay();

// Tạo URL thanh toán VNPay (GET method cho frontend cũ)
exports.createPaymentUrl = async (req, res, next) => {
    try {
        const { orderId, amount } = req.query;

        if (!orderId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin orderId hoặc amount'
            });
        }

        // Tìm đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            });
        }

        // Kiểm tra quyền truy cập
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập đơn hàng này'
            });
        }

        const ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            '127.0.0.1';

        const paymentUrl = vnpay.createPaymentUrl(
            orderId,
            parseInt(amount),
            `Thanh toán đơn hàng ${orderId}`,
            ipAddr
        );

        res.json({
            success: true,
            paymentUrl,
            orderId
        });

    } catch (error) {
        console.error('Lỗi tạo URL thanh toán VNPay (GET):', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi tạo URL thanh toán: ' + error.message
        });
    }
};

// Tạo URL thanh toán VNPay
exports.createPayment = async (req, res, next) => {
    try {
        const { name, phone, email, address, paymentMethod } = req.body;

        // Nới lỏng validation cho sandbox
        const isSandbox = process.env.NODE_ENV === 'development' ||
            process.env.VNPAY_URL.includes('sandbox') ||
            process.env.VNPAY_SANDBOX === 'true';

        if (isSandbox) {
            console.log('🧪 SANDBOX: Nới lỏng validation cho createPayment');

            // Tự động điền thông tin thiếu cho test
            const testData = {
                name: name || 'Test User',
                phone: phone || '0123456789',
                email: email || 'test@example.com',
                address: address || 'Test Address',
                paymentMethod: paymentMethod || 'vnpay'
            };

            console.log('🧪 SANDBOX: Sử dụng test data:', testData);
            req.body = { ...req.body, ...testData };
        } else {
            // Production validation nghiêm ngặt
            if (!name || !phone || !address || paymentMethod !== 'vnpay') {
                return res.status(400).json({ success: false, message: 'Thông tin đơn hàng không hợp lệ' });
            }
        }

        // Lấy giỏ hàng từ session (KHÔNG lấy từ database)
        const cart = req.cart.getCart(); // hoặc: const cart = req.session.cart;

        if (!cart.items || cart.items.length === 0) {
            if (isSandbox) {
                console.warn('🧪 SANDBOX: Giỏ hàng trống, tạo sản phẩm test');
                // Tạo giỏ hàng test
                const testCart = {
                    items: [{
                        productId: 'test_product_' + Date.now(),
                        quantity: 1,
                        title: 'Test Product',
                        price: 10000,
                        imageUrl: '/images/default-product.png'
                    }]
                };
                req.cart = {
                    getCart: () => testCart
                };
                cart.items = testCart.items;
            } else {
                return res.status(400).json({ success: false, message: 'Giỏ hàng trống' });
            }
        }

        const products = cart.items.map(item => ({
            productId: item.productId, // chú ý: session lưu là productId
            quantity: item.quantity,
            title: item.title,
            price: item.price,
            imageUrl: item.imageUrl
        }));

        const subtotal = products.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shippingCalculator = require('../util/shipping-calculator');
        const shippingInfo = shippingCalculator.calculateShippingFee(subtotal);
        const shippingFee = shippingInfo.fee;
        const totalAmount = subtotal + shippingFee;

        const order = new Order(
            req.session.user._id,
            products,
            totalAmount,
            { name, phone, email: email || req.session.user.email, address },
            'vnpay',
            shippingFee
        );
        order.status = 'pending_payment';

        const savedOrder = await order.save();

        const ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            '127.0.0.1';

        const paymentUrl = vnpay.createPaymentUrl(
            savedOrder.insertedId.toString(),
            totalAmount,
            `Thanh toán đơn hàng ${savedOrder.insertedId}`,
            ipAddr
        );

        // Lưu paymentUrl vào đơn hàng
        await Order.updatePaymentUrl(savedOrder.insertedId, paymentUrl);

        res.json({
            success: true,
            paymentUrl,
            orderId: savedOrder.insertedId
        });

    } catch (error) {
        console.error('Lỗi tạo URL thanh toán VNPay:', error);
        res.status(500).json({ success: false, message: 'Lỗi tạo URL thanh toán: ' + error.message });
    }
};

// Xử lý Return URL từ VNPay
exports.vnpayReturn = async (req, res, next) => {
    try {
        const isSandbox = process.env.NODE_ENV === 'development' ||
            process.env.VNPAY_URL.includes('sandbox') ||
            process.env.VNPAY_SANDBOX === 'true';

        if (isSandbox) {
            console.log('🧪 SANDBOX: VNPay Return Callback (Relaxed Mode)');
        } else {
            console.log('=== VNPay Return Callback ===');
        }

        console.log('Query params:', req.query);
        let vnp_Params = { ...req.query };

        // Kiểm tra chữ ký (nới lỏng cho sandbox)
        console.log('🔍 Kiểm tra chữ ký VNPay...');
        const isValidSignature = vnpay.verifyReturnUrl(vnp_Params);
        console.log('✅ Chữ ký hợp lệ:', isValidSignature);

        if (!isValidSignature && !isSandbox) {
            console.error('❌ Chữ ký VNPay không hợp lệ');
            return res.render('shop/payment-result', {
                pageTitle: 'Kết quả thanh toán',
                path: '/payment-result',
                success: false,
                message: 'Chữ ký không hợp lệ',
                orderId: vnp_Params.vnp_TxnRef
            });
        }

        const orderId = vnp_Params.vnp_TxnRef;
        const responseCode = vnp_Params.vnp_ResponseCode;
        const amount = parseInt(vnp_Params.vnp_Amount, 10) / 100;
        const transactionNo = vnp_Params.vnp_TransactionNo;
        const bankCode = vnp_Params.vnp_BankCode;

        console.log('📋 Thông tin thanh toán:');
        console.log('- Order ID:', orderId);
        console.log('- Response Code:', responseCode);
        console.log('- Amount:', amount);
        console.log('- Transaction No:', transactionNo);
        console.log('- Bank Code:', bankCode);

        // Tìm đơn hàng
        console.log('🔍 Tìm đơn hàng với orderId:', orderId);
        const mongodb = require('mongodb');
        let rawOrder = null;

        // Thử tìm bằng ObjectId trước
        try {
            console.log('🔄 Thử tìm bằng ObjectId...');
            rawOrder = await Order.findById(new mongodb.ObjectId(orderId));
            console.log('✅ Tìm thấy đơn hàng bằng ObjectId');
        } catch (e) {
            console.log('⚠️ Không tìm thấy bằng ObjectId, thử tìm bằng string...');
            try {
                rawOrder = await Order.findById(orderId);
                console.log('✅ Tìm thấy đơn hàng bằng string');
            } catch (e2) {
                console.log('⚠️ Không tìm thấy bằng string, thử tìm trong database...');
                // Thử tìm trực tiếp trong database
                const db = require('../util/database').getDb();
                rawOrder = await db.collection('orders').findOne({
                    $or: [
                        { _id: new mongodb.ObjectId(orderId) },
                        { _id: orderId },
                        { "paymentDetails.transactionNo": orderId }
                    ]
                });
                if (rawOrder) {
                    console.log('✅ Tìm thấy đơn hàng trong database');
                }
            }
        }

        if (!rawOrder) {
            console.error('❌ Không tìm thấy đơn hàng với orderId:', orderId);
            console.log('🔍 Thử tìm tất cả orders gần đây...');
            const db = require('../util/database').getDb();
            const recentOrders = await db.collection('orders')
                .find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray();
            console.log('📋 Orders gần đây:', recentOrders.map(o => ({ id: o._id, status: o.status, createdAt: o.createdAt })));

            return res.render('shop/payment-result', {
                pageTitle: 'Không tìm thấy đơn hàng',
                path: '/payment-result',
                success: false,
                message: 'Không tìm thấy đơn hàng',
                orderId
            });
        }

        console.log('✅ Tìm thấy đơn hàng:', rawOrder._id);
        console.log('- Order Status:', rawOrder.status);
        console.log('- Order Total:', rawOrder.totalPrice);
        console.log('- VNPay Amount:', amount);

        // Kiểm tra số tiền
        // Nới lỏng kiểm tra số tiền cho sandbox
        if (rawOrder.totalPrice !== amount) {
            if (isSandbox) {
                console.warn('⚠️ SANDBOX: Số tiền không khớp nhưng vẫn cho phép tiếp tục:', rawOrder.totalPrice, amount);
            } else {
                console.error('⚠️ Số tiền không khớp:', rawOrder.totalPrice, amount);
                // Có thể thêm logic xử lý lỗi ở đây nếu cần
            }
        } else {
            console.log('✅ Số tiền khớp');
        }

        // Cập nhật trực tiếp rawOrder thay vì tạo lại instance
        console.log('🔄 Cập nhật trạng thái đơn hàng...');

        if (responseCode === '00') {
            console.log('✅ Thanh toán thành công (Return URL) - Hiển thị kết quả cho người dùng.');
            // Gửi email xác nhận đơn hàng ngay khi Return URL thành công
            try {
                const user = await User.findById(rawOrder.userId);
                if (user) {
                    await sendOrderConfirmation(orderId, user);
                    console.log('✅ [Return URL] Đã gửi email xác nhận đơn hàng cho user:', user.email);
                }
            } catch (emailErr) {
                console.error('❌ [Return URL] Lỗi gửi email xác nhận:', emailErr);
            }
            // Return URL chỉ để hiển thị, không xử lý logic chính (đã chuyển sang IPN)
            // Có thể kiểm tra lại trạng thái từ DB để chắc chắn
            const freshOrder = await Order.findById(orderId);

            if (freshOrder && (freshOrder.status === 'confirmed' || freshOrder.status === 'paid')) {
                 console.log('✅ Trạng thái đơn hàng đã được IPN cập nhật.');
            } else {
                 console.warn('⚠️ (Return URL) Trạng thái đơn hàng chưa được IPN cập nhật, có thể có độ trễ.');
            }

            return res.render('shop/payment-result', {
                pageTitle: 'Thanh toán thành công',
                path: '/payment-result',
                success: true,
                message: 'Thanh toán thành công. Vui lòng kiểm tra email để xem chi tiết đơn hàng.',
                orderId,
                transactionNo,
                amount
            });

        } else {
            console.log('❌ Thanh toán thất bại với mã (Return URL):', responseCode);
            // Không cần cập nhật DB ở đây, IPN sẽ xử lý
            return res.render('shop/payment-result', {
                pageTitle: 'Thanh toán thất bại',
                path: '/payment-result',
                success: false,
                message: vnpay.getResponseMessage(responseCode) || 'Giao dịch không thành công.',
                orderId
            });
        }

    } catch (error) {
        console.error('Lỗi xử lý Return URL:', error);
        res.render('shop/payment-result', {
            pageTitle: 'Lỗi thanh toán',
            path: '/payment-result',
            success: false,
            message: 'Có lỗi xảy ra khi xử lý kết quả thanh toán',
            orderId: req.query.vnp_TxnRef || 'N/A'
        });
    }
};

// Xử lý IPN từ VNPay
exports.vnpayIPN = async (req, res, next) => {
    try {
        console.log('--- VNPay IPN Callback ---');
        console.log('Query params:', req.query);
        let vnp_Params = { ...req.query };
        const isValidSignature = vnpay.verifyReturnUrl(vnp_Params);

        if (!isValidSignature) {
            return res.json({ RspCode: '97', Message: 'Invalid signature' });
        }

        const orderId = vnp_Params.vnp_TxnRef;
        const responseCode = vnp_Params.vnp_ResponseCode;
        const amount = parseInt(vnp_Params.vnp_Amount, 10) / 100;

        const rawOrder = await Order.findById(orderId);
        if (!rawOrder) return res.json({ RspCode: '01', Message: 'Order not found' });

        const orderItems = Array.isArray(rawOrder.items) && rawOrder.items.length > 0
            ? rawOrder.items
            : (Array.isArray(rawOrder.products) ? rawOrder.products : []);
        const order = new Order(
            rawOrder.userId,
            orderItems,
            rawOrder.totalPrice,
            rawOrder.shippingInfo,
            rawOrder.paymentMethod,
            rawOrder.shippingFee || 0
        );
        order._id = rawOrder._id;

        if (order.totalPrice !== amount) {
            return res.json({ RspCode: '04', Message: 'Invalid amount' });
        }

        if (responseCode === '00') {
            if (order.status !== 'paid' && order.status !== 'confirmed') {
                order.status = 'confirmed';
                order.paymentStatus = 'paid';
                order.paymentMethod = 'vnpay';
                order.paymentDetails = {
                    transactionNo: vnp_Params.vnp_TransactionNo,
                    bankCode: vnp_Params.vnp_BankCode,
                    responseCode,
                    paidAt: new Date()
                };
                await order.save();

                // Cập nhật tồn kho khi thanh toán thành công (IPN)
                try {
                    if (orderItems && orderItems.length > 0) {
                        await Product.updateStockForOrder(orderItems);
                        console.log('✅ Đã cập nhật tồn kho cho đơn hàng VNPay (IPN):', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để cập nhật tồn kho cho đơn hàng VNPay (IPN):', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi cập nhật tồn kho cho đơn hàng VNPay (IPN):', err);
                }

                // Gửi email xác nhận từ IPN
                try {
                    const user = await User.findById(rawOrder.userId);
                    if (user) {
                        await sendOrderConfirmation(orderId, user);
                        console.log('✅ Email xác nhận đơn hàng VNPay đã gửi từ IPN');
                    }
                } catch (emailErr) {
                    console.error('❌ Lỗi gửi email xác nhận từ IPN:', emailErr);
                }

                // Xóa giỏ hàng
                try {
                    const user = await User.findById(rawOrder.userId);
                    if (user) {
                        await user.clearCart();
                        console.log('✅ Đã xóa giỏ hàng từ IPN');
                    }
                } catch(err) {
                    console.error('❌ Lỗi xóa giỏ hàng từ IPN:', err);
                }

            }
        } else {
            order.status = 'payment_failed';
            order.paymentStatus = 'failed';
            order.paymentDetails = {
                responseCode,
                failedAt: new Date(),
                failureReason: vnpay.getResponseMessage(responseCode)
            };
            await order.save();

            // Hoàn lại tồn kho khi thanh toán thất bại (IPN)
            try {
                if (orderItems && orderItems.length > 0) {
                    await Product.restoreStockForOrder(orderItems);
                    console.log('✅ Đã hoàn lại tồn kho cho đơn hàng VNPay thất bại (IPN):', orderId);
                } else {
                    console.warn('⚠️ Không có sản phẩm nào để hoàn lại tồn kho cho đơn hàng VNPay thất bại (IPN):', orderId);
                }
            } catch (err) {
                console.error('❌ Lỗi khi hoàn lại tồn kho cho đơn hàng VNPay thất bại (IPN):', err);
                // Không throw error vì đơn hàng đã được cập nhật thành công
                // Chỉ log để admin có thể xử lý sau
            }
        }

        return res.json({ RspCode: '00', Message: 'Success' });

    } catch (error) {
        console.error('Lỗi xử lý IPN:', error);
        res.json({ RspCode: '99', Message: 'Unknown error' });
    }
};
