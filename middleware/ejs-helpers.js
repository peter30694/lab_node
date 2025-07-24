/**
 * EJS Helper Functions Middleware
 * Cung cấp các helper functions cho EJS templates
 */

const shippingCalculator = require('../util/shipping-calculator');

const ejsHelpers = (req, res, next) => {
    // Helper function để tính phí vận chuyển
    res.locals.calculateShippingFee = (orderValue) => {
        return shippingCalculator.calculateShippingFee(orderValue);
    };

    // Helper function để format tiền tệ
    res.locals.formatCurrency = (amount) => {
        return (amount || 0).toLocaleString('vi-VN');
    };

    // Helper function để tính tổng tiền đơn hàng
    res.locals.calculateTotalAmount = (subtotal, shippingFee = 0, discount = 0) => {
        return (subtotal || 0) + (shippingFee || 0) - (discount || 0);
    };

    // Helper function để kiểm tra xem có miễn phí vận chuyển không
    res.locals.isFreeShipping = (orderValue) => {
        const shippingInfo = shippingCalculator.calculateShippingFee(orderValue);
        return shippingInfo.fee === 0;
    };

    // Helper function để lấy thông tin mức phí tiếp theo
    res.locals.getNextTierInfo = (orderValue) => {
        return shippingCalculator.getNextTierInfo(orderValue);
    };

    next();
};

module.exports = ejsHelpers; 