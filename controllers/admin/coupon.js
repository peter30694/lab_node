const Coupon = require('../../models/coupon');

exports.getCoupons = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const db = require('../../util/database').getDb();
        const totalCoupons = await db.collection('coupons').countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);
        const coupons = await db.collection('coupons')
            .find()
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        res.render('admin/coupons', {
            pageTitle: 'Quản lý mã giảm giá',
            path: '/admin/coupons',
            coupons: coupons,
            currentPage: page,
            totalPages: totalPages,
            totalCoupons: totalCoupons,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            limit: limit
        });
    } catch (err) {
        next(err);
    }
};

exports.getAddCoupon = (req, res, next) => {
    res.render('admin/add-coupon', {
        pageTitle: 'Thêm mã giảm giá',
        path: '/admin/coupons/add',
        editing: false,
        error: null,
        success: null
    });
};

exports.postAddCoupon = async (req, res, next) => {
    try {
        const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, startDate, endDate } = req.body;
        // Kiểm tra mã đã tồn tại
        const existing = await Coupon.checkCodeExists(code);
        if (existing.exists) {
            return res.render('admin/add-coupon', {
                pageTitle: 'Thêm mã giảm giá',
                path: '/admin/coupons/add',
                editing: false,
                error: 'Mã giảm giá đã tồn tại!',
                success: null
            });
        }
        const newCoupon = new Coupon(
            code,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            usageLimit,
            0, // usedCount
            startDate,
            endDate,
            true // isActive
        );
        await newCoupon.save();
        res.redirect('/admin/coupons');
    } catch (err) {
        next(err);
    }
};

exports.getEditCoupon = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons');
        }
        res.render('admin/edit-coupon', {
            pageTitle: 'Chỉnh sửa mã giảm giá',
            path: '/admin/coupons',
            editing: true,
            coupon: coupon,
            error: null,
            success: null
        });
    } catch (err) {
        next(err);
    }
};

exports.postEditCoupon = async (req, res, next) => {
    try {
        const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, startDate, endDate, isActive } = req.body;
        const couponId = req.params.couponId;
        const updatedCoupon = {
            code,
            discountType,
            discountValue: parseFloat(discountValue),
            minOrderValue: minOrderValue ? parseFloat(minOrderValue) : 0,
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : 0,
            usageLimit: usageLimit ? parseInt(usageLimit) : 1,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            isActive: isActive === 'true' || isActive === true
        };
        await Coupon.updateById(couponId, updatedCoupon);
        res.redirect('/admin/coupons');
    } catch (err) {
        // Nếu lỗi, render lại form với thông báo lỗi
        const coupon = await Coupon.findById(req.params.couponId);
        res.render('admin/edit-coupon', {
            pageTitle: 'Chỉnh sửa mã giảm giá',
            path: '/admin/coupons',
            editing: true,
            coupon: coupon,
            error: 'Có lỗi xảy ra khi cập nhật mã giảm giá',
            success: null
        });
    }
};

exports.deleteCoupon = async (req, res, next) => {
    try {
        const result = await Coupon.deleteById(req.params.couponId);
        if (!result) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá để xóa.' });
        }
        res.status(200).json({ message: 'Success!' });
    } catch (err) {
        res.status(500).json({ message: 'Deleting coupon failed.', error: err.message });
    }
};


exports.getCouponStats = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.generateCouponCode = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
}; 