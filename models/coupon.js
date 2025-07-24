const getDb = require('../util/database').getDb;
const mongodb = require('mongodb');

class Coupon {
    constructor(code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, usedCount, startDate, endDate, isActive) {
        // Validate required fields
        this.validateCouponData(code, discountType, discountValue, startDate, endDate);
        
        this.code = this.validateCode(code);
        this.discountType = this.validateDiscountType(discountType);
        this.discountValue = this.validateDiscountValue(discountValue, discountType);
        this.minOrderValue = parseFloat(minOrderValue) || 0;
        this.maxDiscount = parseFloat(maxDiscount) || 0;
        this.usageLimit = parseInt(usageLimit) || 1;
        this.usedCount = parseInt(usedCount) || 0;
        this.startDate = new Date(startDate);
        this.endDate = new Date(endDate);
        this.isActive = isActive !== undefined ? isActive : true;
        this.createdAt = new Date();
    }

    validateCouponData(code, discountType, discountValue, startDate, endDate) {
        if (!code || code.trim().length === 0) {
            throw new Error('Mã giảm giá không được để trống');
        }
        if (!discountType) {
            throw new Error('Loại giảm giá là bắt buộc');
        }
        if (!discountValue || discountValue <= 0) {
            throw new Error('Giá trị giảm phải lớn hơn 0');
        }
        if (!startDate) {
            throw new Error('Ngày bắt đầu là bắt buộc');
        }
        if (!endDate) {
            throw new Error('Ngày kết thúc là bắt buộc');
        }
        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
        }
    }

    validateCode(code) {
        const trimmedCode = code.trim().toUpperCase();
        
        // Kiểm tra độ dài
        if (trimmedCode.length < 3 || trimmedCode.length > 20) {
            throw new Error('Mã giảm giá phải từ 3-20 ký tự');
        }
        
        // Kiểm tra format (chỉ cho phép chữ cái, số, dấu gạch ngang)
        const codeRegex = /^[A-Z0-9-]+$/;
        if (!codeRegex.test(trimmedCode)) {
            throw new Error('Mã giảm giá chỉ được chứa chữ cái, số và dấu gạch ngang');
        }
        
        return trimmedCode;
    }

    validateDiscountType(discountType) {
        const validTypes = ['percentage', 'fixed'];
        if (!validTypes.includes(discountType)) {
            throw new Error('Loại giảm giá không hợp lệ');
        }
        return discountType;
    }

    validateDiscountValue(discountValue, discountType) {
        const numValue = parseFloat(discountValue);
        
        if (isNaN(numValue) || numValue <= 0) {
            throw new Error('Giá trị giảm phải là số dương');
        }
        
        if (discountType === 'percentage') {
            if (numValue > 100) {
                throw new Error('Phần trăm giảm giá không đượt quá 100%');
            }
        } else if (discountType === 'fixed') {
            if (numValue > 10000000) { // 10 triệu
                throw new Error('Giá trị giảm cố định không đượt quá 10,000,000đ');
            }
        }
        
        return numValue;
    }

    save() {
        const db = getDb();
        return db.collection('coupons').insertOne(this);
    }

    static findById(id) {
        const db = getDb();
        return db.collection('coupons').findOne({ _id: new mongodb.ObjectId(id) });
    }

    // ✅ THÊM METHOD findByCode nếu chưa có
    static async findByCode(code) {
        try {
            const db = getDb();
            const coupon = await db.collection('coupons').findOne({ 
                code: { $regex: new RegExp(`^${code}$`, 'i') } 
            });
            return coupon;
        } catch (err) {
            console.error('Lỗi khi tìm coupon theo code:', err);
            throw err;
        }
    }

    static findAll() {
        const db = getDb();
        return db.collection('coupons').find().toArray();
    }

    static findActive() {
        const db = getDb();
        const now = new Date();
        return db.collection('coupons').find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).toArray();
    }

    static updateById(id, updateData) {
        const db = getDb();
        return db.collection('coupons').updateOne(
            { _id: new mongodb.ObjectId(id) },
            { $set: updateData }
        );
    }

    static deleteById(id) {
        const db = getDb();
        return db.collection('coupons').deleteOne({ _id: new mongodb.ObjectId(id) });
    }

    static incrementUsage(code) {
        const db = getDb();
        return db.collection('coupons').updateOne(
            { code: code },
            { $inc: { usedCount: 1 } }
        );
    }

    // Kiểm tra mã giảm giá đã tồn tại
    static async checkCodeExists(code) {
        try {
            const db = getDb();
            // Tìm kiếm chính xác trước, nếu không tìm thấy thì tìm case insensitive
            let existingCoupon = await db.collection('coupons')
                .findOne({ code: code });
            
            if (!existingCoupon) {
                // Thử tìm kiếm case insensitive
                existingCoupon = await db.collection('coupons')
                    .findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } });
            }
            
            return {
                exists: !!existingCoupon,
                coupon: existingCoupon
            };
        } catch (err) {
            console.error('Lỗi khi kiểm tra mã giảm giá tồn tại:', err);
            throw err;
        }
    }

    // Kiểm tra mã giảm giá có thể sử dụng
    static async checkCouponUsability(code, userId = null) {
        try {
            const db = getDb();
            // Tìm kiếm chính xác trước, nếu không tìm thấy thì tìm case insensitive
            let coupon = await db.collection('coupons')
                .findOne({ code: code });
            
            if (!coupon) {
                // Thử tìm kiếm case insensitive
                coupon = await db.collection('coupons')
                    .findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } });
            }
            
            if (!coupon) {
                return {
                    usable: false,
                    message: 'Mã giảm giá không tồn tại'
                };
            }
            
            if (!coupon.isActive) {
                return {
                    usable: false,
                    message: 'Mã giảm giá đã bị vô hiệu hóa'
                };
            }
            
            const now = new Date();
            if (now < coupon.startDate) {
                return {
                    usable: false,
                    message: 'Mã giảm giá chưa có hiệu lực'
                };
            }
            
            if (now > coupon.endDate) {
                return {
                    usable: false,
                    message: 'Mã giảm giá đã hết hạn'
                };
            }
            
            if (coupon.usedCount >= coupon.usageLimit) {
                return {
                    usable: false,
                    message: 'Mã giảm giá đã hết lượt sử dụng'
                };
            }
            
            // Kiểm tra user đã sử dụng mã này chưa (nếu có user)
            if (userId) {
                const userUsage = await db.collection('coupon_usage')
                    .findOne({ 
                        couponId: coupon._id,
                        userId: userId 
                    });
                
                if (userUsage) {
                    return {
                        usable: false,
                        message: 'Bạn đã sử dụng mã giảm giá này rồi'
                    };
                }
            }
            
            return {
                usable: true,
                coupon: coupon,
                message: 'Mã giảm giá hợp lệ'
            };
        } catch (err) {
            console.error('Lỗi khi kiểm tra khả năng sử dụng mã giảm giá:', err);
            throw err;
        }
    }

    // Kiểm tra mã giảm giá có hợp lệ không
    static validateCoupon(code, orderValue, userId = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // ===== KIỂM TRA KHẢ NĂNG SỬ DỤNG =====
                const usabilityCheck = await this.checkCouponUsability(code, userId);
                if (!usabilityCheck.usable) {
                    return resolve({ 
                        valid: false, 
                        message: usabilityCheck.message 
                    });
                }

                const coupon = usabilityCheck.coupon;

                // ===== KIỂM TRA GIÁ TRỊ ĐƠN HÀNG TỐI THIỂU =====
                if (orderValue < coupon.minOrderValue) {
                    return resolve({ 
                        valid: false, 
                        message: `Đơn hàng tối thiểu ${coupon.minOrderValue.toLocaleString('vi-VN')}đ` 
                    });
                }

                // ===== TÍNH TOÁN GIÁ TRỊ GIẢM =====
                let discountAmount = 0;
                if (coupon.discountType === 'percentage') {
                    discountAmount = (orderValue * coupon.discountValue) / 100;
                    if (coupon.maxDiscount > 0) {
                        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
                    }
                } else {
                    discountAmount = Math.min(coupon.discountValue, orderValue);
                }

                // ===== KIỂM TRA GIÁ TRỊ GIẢM KHÔNG VƯỢT QUÁ ĐƠN HÀNG =====
                if (discountAmount >= orderValue) {
                    return resolve({ 
                        valid: false, 
                        message: 'Giá trị giảm không được vượt quá giá trị đơn hàng' 
                    });
                }

                return resolve({
                    valid: true,
                    coupon: coupon,
                    discountAmount: discountAmount,
                    message: 'Mã giảm giá hợp lệ'
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Ghi lại việc sử dụng mã giảm giá
    static async recordUsage(couponId, userId, orderId) {
        try {
            const db = getDb();
            
            // Tăng số lần sử dụng
            await db.collection('coupons').updateOne(
                { _id: new mongodb.ObjectId(couponId) },
                { $inc: { usedCount: 1 } }
            );
            
            // Ghi lại lịch sử dụng
            const usageData = {
                couponId: new mongodb.ObjectId(couponId),
                userId: userId,
                usedAt: new Date()
            };
            
            // Kiểm tra orderId có phải là ObjectId hợp lệ không
            if (orderId && typeof orderId === 'string') {
                if (orderId.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderId)) {
                    usageData.orderId = new mongodb.ObjectId(orderId);
                } else {
                    usageData.orderId = orderId; // Giữ nguyên nếu không phải ObjectId hợp lệ
                }
            } else {
                usageData.orderId = orderId; // Giữ nguyên nếu không phải string
            }
            
            await db.collection('coupon_usage').insertOne(usageData);
            
            console.log(`✅ Đã ghi lại việc sử dụng mã giảm giá: ${couponId} cho user: ${userId}`);
        } catch (err) {
            console.error('Lỗi khi ghi lại việc sử dụng mã giảm giá:', err);
            throw err;
        }
    }

    // Lấy thống kê mã giảm giá
    static async getCouponStats() {
        try {
            const db = getDb();
            
            // Tổng số mã giảm giá
            const totalCoupons = await db.collection('coupons').countDocuments();
            
            // Mã giảm giá theo trạng thái
            const activeCoupons = await db.collection('coupons').countDocuments({ isActive: true });
            const inactiveCoupons = await db.collection('coupons').countDocuments({ isActive: false });
            
            // Mã giảm giá theo loại
            const percentageCoupons = await db.collection('coupons').countDocuments({ discountType: 'percentage' });
            const fixedCoupons = await db.collection('coupons').countDocuments({ discountType: 'fixed' });
            
            // Mã giảm giá sắp hết hạn (7 ngày tới)
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const expiringCoupons = await db.collection('coupons').countDocuments({
                endDate: { $lte: sevenDaysFromNow, $gte: new Date() }
            });
            
            // Mã giảm giá đã hết hạn
            const expiredCoupons = await db.collection('coupons').countDocuments({
                endDate: { $lt: new Date() }
            });
            
            // Mã giảm giá đã hết lượt sử dụng
            const exhaustedCoupons = await db.collection('coupons').countDocuments({
                $expr: { $gte: ['$usedCount', '$usageLimit'] }
            });
            
            return {
                total: totalCoupons,
                active: activeCoupons,
                inactive: inactiveCoupons,
                percentage: percentageCoupons,
                fixed: fixedCoupons,
                expiring: expiringCoupons,
                expired: expiredCoupons,
                exhausted: exhaustedCoupons
            };
        } catch (err) {
            console.error('Lỗi khi lấy thống kê mã giảm giá:', err);
            throw err;
        }
    }

    // Hàm sửa chữa dữ liệu mã giảm giá bị lỗi
    static async fixCouponUsageData() {
        try {
            const db = getDb();
            
            console.log('🔧 Bắt đầu sửa chữa dữ liệu mã giảm giá...');
            
            // Lấy tất cả mã giảm giá
            const coupons = await db.collection('coupons').find().toArray();
            
            for (const coupon of coupons) {
                // Đếm số lần sử dụng thực tế từ coupon_usage
                const actualUsageCount = await db.collection('coupon_usage').countDocuments({
                    couponId: coupon._id
                });
                
                // Đếm số lần sử dụng thực tế từ orders
                const orderUsageCount = await db.collection('orders').countDocuments({
                    'appliedCoupon.code': coupon.code,
                    $or: [
                        { status: 'paid' },
                        { status: 'pending', paymentMethod: 'cod' }
                    ]
                });
                
                // Sử dụng số lớn hơn làm chuẩn
                const correctUsageCount = Math.max(actualUsageCount, orderUsageCount);
                
                if (coupon.usedCount !== correctUsageCount) {
                    console.log(`🔧 Sửa mã ${coupon.code}: ${coupon.usedCount} → ${correctUsageCount}`);
                    
                    await db.collection('coupons').updateOne(
                        { _id: coupon._id },
                        { $set: { usedCount: correctUsageCount } }
                    );
                }
            }
            
            console.log('✅ Hoàn thành sửa chữa dữ liệu mã giảm giá');
            
        } catch (err) {
            console.error('❌ Lỗi khi sửa chữa dữ liệu mã giảm giá:', err);
            throw err;
        }
    }
}

module.exports = Coupon;