const mongodb = require('mongodb');
const { getDb } = require('../util/database');
const { ValidationError, DatabaseError, NotFoundError } = require('../util/errors');

class Order {
    constructor(userId, items, totalPrice, shippingInfo = {}, paymentMethod = 'cod', shippingFee = 0, appliedCoupon = null) {
        // Validate required fields
        this.validateOrderData(userId, items, totalPrice, shippingInfo, paymentMethod);
        
        this._id = new mongodb.ObjectId(); // Tạo _id ngay khi khởi tạo
        this.userId = userId;
        this.items = this.validateAndNormalizeItems(items);
        this.totalPrice = this.validatePrice(totalPrice);
        this.shippingInfo = this.validateShippingInfo(shippingInfo);
        this.paymentMethod = this.validatePaymentMethod(paymentMethod);
        this.shippingFee = parseFloat(shippingFee) || 0;
        this.appliedCoupon = appliedCoupon;
        this.discountAmount = appliedCoupon ? this.calculateDiscountAmount() : 0;
        this.status = 'pending';
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.paymentStatus = this.getInitialPaymentStatus(paymentMethod);
    }

    validateOrderData(userId, items, totalPrice, shippingInfo, paymentMethod) {
        if (!userId) {
            throw new ValidationError('User ID là bắt buộc');
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new ValidationError('Đơn hàng phải có ít nhất 1 sản phẩm');
        }
        if (totalPrice === undefined || totalPrice === null || totalPrice < 0) {
            throw new ValidationError('Tổng tiền không hợp lệ');
        }
        // Cho phép totalPrice = 0 (trường hợp miễn phí hoàn toàn)
    }

    validateAndNormalizeItems(items) {
        return items.map(item => {
            if (!item.productId) {
                throw new ValidationError('Product ID là bắt buộc');
            }
            if (!item.quantity || item.quantity <= 0) {
                throw new ValidationError('Số lượng phải lớn hơn 0');
            }
            if (!item.price || item.price <= 0) {
                throw new ValidationError('Giá sản phẩm phải lớn hơn 0');
            }
            
            return {
                productId: item.productId,
                title: item.title || 'Sản phẩm không xác định',
                price: parseFloat(item.price),
                quantity: parseInt(item.quantity),
                imageUrl: item.imageUrl || '/images/default-product.png'
            };
        });
    }

    validatePrice(price) {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice <= 0) {
            throw new ValidationError('Giá không hợp lệ');
        }
        return numPrice;
    }

    validateShippingInfo(shippingInfo) {
        const required = ['name', 'phone', 'email', 'address'];
        const validated = {};
        
        for (const field of required) {
            if (!shippingInfo[field] || shippingInfo[field].trim() === '') {
                throw new ValidationError(`${field} là bắt buộc`);
            }
            validated[field] = shippingInfo[field].trim();
        }
        
        // Validate email format - chặt chẽ hơn
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(validated.email)) {
            throw new ValidationError('Email không hợp lệ');
        }
        
        // Validate phone format - chặt chẽ hơn
        const phoneRegex = /^[0-9]{10,11}$/;
        const cleanPhone = validated.phone.replace(/\s/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            throw new ValidationError('Số điện thoại phải có 10-11 chữ số');
        }
        
        // Validate name length - linh hoạt hơn
        if (validated.name.length < 1 || validated.name.length > 100) {
            throw new ValidationError('Tên phải từ 1-100 ký tự');
        }
        
        // Validate address length - linh hoạt hơn
        if (validated.address.length < 5 || validated.address.length > 300) {
            throw new ValidationError('Địa chỉ phải từ 5-300 ký tự');
        }
        
        return validated;
    }

    validatePaymentMethod(method) {
        const validMethods = ['cod', 'vnpay', 'bank', 'ewallet', 'credit'];
        if (!validMethods.includes(method)) {
            throw new ValidationError('Phương thức thanh toán không hợp lệ');
        }
        return method;
    }

    getInitialPaymentStatus(method) {
        switch (method) {
            case 'cod': return 'pending';
            case 'bank':
            case 'bank_transfer':
            case 'ewallet':
            case 'vnpay': return 'awaiting_payment';
            case 'credit': return 'processing';
            default: return 'pending';
        }
    }

    calculateDiscountAmount() {
        if (!this.appliedCoupon) return 0;
        
        const subtotal = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        
        if (this.appliedCoupon.discountType === 'percentage') {
            return (subtotal * this.appliedCoupon.discountValue) / 100;
        } else if (this.appliedCoupon.discountType === 'fixed') {
            return Math.min(this.appliedCoupon.discountValue, subtotal);
        }
        
        return 0;
    }

    getPaymentMethodName() {
        const methods = {
            'cod': 'Thanh toán khi nhận hàng (COD)',
            'bank': 'Chuyển khoản ngân hàng',
            'bank_transfer': 'Chuyển khoản QR Code',
            'ewallet': 'Ví điện tử',
            'credit': 'Thẻ tín dụng/ghi nợ',
            'vnpay': 'Thanh toán qua VNPay'
        };
        return methods[this.paymentMethod] || 'Không xác định';
    }

    getPaymentStatusName() {
        const statuses = {
            'pending': 'Chờ thanh toán',
            'awaiting_payment': 'Chờ chuyển khoản',
            'processing': 'Đang xử lý',
            'completed': 'Đã thanh toán',
            'failed': 'Thanh toán thất bại',
            'refunded': 'Đã hoàn tiền'
        };
        return statuses[this.paymentStatus] || 'Không xác định';
    }

    async save() {
        const db = getDb();
        try {
            await db.collection('orders').createIndex({ userId: 1 });
            await db.collection('orders').createIndex({ createdAt: -1 });

            // Log thông tin trước khi lưu
            console.log('🛒 Saving order with data:', {
                _id: this._id,
                userId: this.userId,
                totalPrice: this.totalPrice,
                discountAmount: this.discountAmount,
                appliedCoupon: this.appliedCoupon,
                itemsCount: this.items ? this.items.length : 0
            });

            // Luôn insert mới vì order được tạo với _id mới
            const result = await db.collection('orders').insertOne(this);
            if (!result.insertedId) {
                throw new DatabaseError('Không thể tạo đơn hàng mới');
            }
            
            console.log('🛒 Order saved successfully:', result);
            return result;
            
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Lỗi khi lưu đơn hàng:', error);
            throw new DatabaseError('Lỗi khi lưu đơn hàng vào cơ sở dữ liệu');
        }
    }

    static async findById(orderId) {
        const db = getDb();
        try {
            if (!orderId) {
                throw new ValidationError('Order ID là bắt buộc');
            }
            
            const order = await db.collection('orders').findOne({ _id: new mongodb.ObjectId(orderId) });
            if (!order) {
                throw new NotFoundError('Không tìm thấy đơn hàng');
            }
            
            return order;
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Lỗi khi tìm đơn hàng theo ID:', error);
            throw new DatabaseError('Lỗi khi truy vấn đơn hàng');
        }
    }

    static async findByUserId(userId) {
        const db = getDb();
        try {
            if (!userId) {
                throw new ValidationError('User ID là bắt buộc');
            }
            
            await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });
            const orders = await db.collection('orders')
                .find({ userId: userId })
                .sort({ createdAt: -1 })
                .toArray();
            
            return orders;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Lỗi khi tìm đơn hàng theo user ID:', error);
            throw new DatabaseError('Lỗi khi truy vấn đơn hàng của người dùng');
        }
    }

    static async updateStatus(orderId, status) {
        const db = getDb();
        try {
            return await db.collection('orders').updateOne(
                { _id: new mongodb.ObjectId(orderId) },
                {
                    $set: {
                        status: status,
                        updatedAt: new Date()
                    }
                }
            );
        } catch (error) {
            console.error('❌ Lỗi khi cập nhật trạng thái đơn hàng:', error);
            throw error;
        }
    }

    static async updatePaymentStatus(orderId, paymentData) {
        const db = getDb();
        try {
            const updateData = {
                updatedAt: new Date()
            };

            if (typeof paymentData === 'string') {
                updateData.paymentStatus = paymentData;
            } else {
                if (paymentData.paymentStatus) updateData.paymentStatus = paymentData.paymentStatus;
                if (paymentData.paymentMethod) updateData.paymentMethod = paymentData.paymentMethod;
                if (paymentData.transactionId) updateData.transactionId = paymentData.transactionId;
                if (paymentData.paidAt) updateData.paidAt = paymentData.paidAt;
                if (paymentData.failedAt) updateData.failedAt = paymentData.failedAt;
                if (paymentData.failureReason) updateData.failureReason = paymentData.failureReason;
            }

            return await db.collection('orders').updateOne(
                { _id: new mongodb.ObjectId(orderId) },
                { $set: updateData }
            );
        } catch (error) {
            console.error('❌ Lỗi khi cập nhật trạng thái thanh toán:', error);
            throw error;
        }
    }

    static async updateOrderStatus(orderId, status, note = '') {
        const db = getDb();
        try {
            const updateData = {
                status: status,
                updatedAt: new Date()
            };

            if (note) {
                updateData.statusNote = note;
            }

            return await db.collection('orders').updateOne(
                { _id: new mongodb.ObjectId(orderId) },
                { $set: updateData }
            );
        } catch (error) {
            console.error('❌ Lỗi khi cập nhật trạng thái đơn hàng:', error);
            throw error;
        }
    }

    static async findAll() {
        const db = getDb();
        try {
            return await db.collection('orders')
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
        } catch (error) {
            console.error('❌ Lỗi khi lấy tất cả đơn hàng:', error);
            return [];
        }
    }

    getStatusDisplay() {
        const statusMap = {
            'pending': 'Chờ xác nhận',
            'confirmed': 'Đã xác nhận',
            'shipping': 'Đang giao',
            'delivered': 'Đã giao',
            'cancelled': 'Đã hủy'
        };
        return statusMap[this.status] || 'Không xác định';
    }

    getPaymentMethodDisplay() {
        return this.getPaymentMethodName();
    }

    getPaymentStatusDisplay() {
        return this.getPaymentStatusName();
    }

    static async updatePaymentUrl(orderId, paymentUrl) {
        const db = getDb();
        await db.collection('orders').updateOne(
            { _id: new mongodb.ObjectId(orderId) },
            { $set: { paymentUrl } }
        );
    }

    static async deleteById(orderId) {
        const db = getDb();
        await db.collection('orders').deleteOne({ _id: new mongodb.ObjectId(orderId) });
    }

    static async deleteAllByUserId(userId) {
        const db = getDb();
        await db.collection('orders').deleteMany({ userId: userId });
    }

    static async deleteManyBeforeDate(date) {
        const db = getDb();
        try {
            if (!date) throw new Error('Date is required');
            const result = await db.collection('orders').deleteMany({ createdAt: { $lt: date } });
            return result;
        } catch (error) {
            console.error('❌ Lỗi khi xóa đơn hàng trước ngày:', error);
            throw error;
        }
    }

    static async countDocuments(filter = {}) {
        const db = getDb();
        try {
            const count = await db.collection('orders').countDocuments(filter);
            return count;
        } catch (error) {
            console.error('❌ Lỗi khi đếm đơn hàng:', error);
            throw new DatabaseError('Lỗi khi đếm đơn hàng');
        }
    }

    // Kiểm tra trùng lặp đơn hàng
    static async checkDuplicateOrder(userId, items, timeWindow = 30 * 1000) { // 30 giây
        try {
            const db = getDb();
            const recentTime = new Date(Date.now() - timeWindow);
            
            // Kiểm tra đơn hàng gần đây của user với cùng sản phẩm
            const recentOrders = await db.collection('orders')
                .find({
                    userId: userId,
                    createdAt: { $gte: recentTime },
                    status: { $in: ['pending', 'confirmed', 'processing'] }
                })
                .toArray();
            
            // Kiểm tra xem có đơn hàng nào có cùng sản phẩm không
            for (const recentOrder of recentOrders) {
                const recentItemIds = recentOrder.items.map(item => item.productId.toString()).sort();
                const currentItemIds = items.map(item => item.productId.toString()).sort();
                
                // So sánh danh sách sản phẩm
                if (JSON.stringify(recentItemIds) === JSON.stringify(currentItemIds)) {
                    return {
                        hasDuplicate: true,
                        message: 'Bạn đã đặt đơn hàng tương tự gần đây, vui lòng chờ xử lý'
                    };
                }
            }
            
            return { hasDuplicate: false };
        } catch (err) {
            console.error('Lỗi khi kiểm tra trùng lặp đơn hàng:', err);
            throw err;
        }
    }

    // Validate tổng tiền đơn hàng
    validateTotalPrice(subtotal, shippingFee, discountAmount) {
        const calculatedTotal = subtotal + shippingFee - discountAmount;
        
        if (calculatedTotal <= 0) {
            throw new ValidationError('Tổng tiền đơn hàng phải lớn hơn 0');
        }
        
        if (discountAmount > subtotal) {
            throw new ValidationError('Giảm giá không được vượt quá giá trị đơn hàng');
        }
        
        return calculatedTotal;
    }
}

// Thống kê doanh thu theo tháng
Order.getMonthlyRevenue = async function (months = 6) {
    const db = getDb();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const pipeline = [
        { $match: { createdAt: { $gte: start }, paymentStatus: { $in: ['paid', 'completed'] } } },
        {
            $group: {
                _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ];

    const results = await db.collection('orders').aggregate(pipeline).toArray();
    return results.map(r => ({
        month: `${r._id.month}/${r._id.year}`,
        revenue: r.revenue,
        orders: r.orders
    }));
};

// Thống kê sản phẩm bán chạy
Order.getPopularProducts = async function (limit = 5) {
    const db = getDb();
    const pipeline = [
        { $unwind: '$items' },
        { $match: { paymentStatus: { $in: ['paid', 'completed'] } } },
        {
            $group: {
                _id: '$items.productId',
                title: { $first: '$items.title' },
                quantity: { $sum: '$items.quantity' },
                revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
            }
        },
        { $sort: { quantity: -1, revenue: -1 } },
        { $limit: limit }
    ];
    return await db.collection('orders').aggregate(pipeline).toArray();
};

module.exports = Order;
