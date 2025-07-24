/**
 * Shipping Fee Calculator
 * Tính phí vận chuyển dựa vào giá trị đơn hàng
 */

class ShippingCalculator {
    constructor() {
        // Cấu hình các mức phí vận chuyển
        this.shippingTiers = [
            {
                minAmount: 0,
                maxAmount: 199999,
                fee: 50000,
                description: 'Phí vận chuyển cơ bản'
            },
            {
                minAmount: 200000,
                maxAmount: 499999,
                fee: 35000,
                description: 'Phí vận chuyển tiêu chuẩn'
            },
            {
                minAmount: 500000,
                maxAmount: 999999,
                fee: 25000,
                description: 'Phí vận chuyển ưu đãi'
            },
            {
                minAmount: 1000000,
                maxAmount: 1999999,
                fee: 15000,
                description: 'Phí vận chuyển cao cấp'
            },
            {
                minAmount: 2000000,
                maxAmount: Infinity,
                fee: 0,
                description: 'Miễn phí vận chuyển'
            }
        ];
    }

    /**
     * Tính phí vận chuyển dựa vào giá trị đơn hàng
     * @param {number} orderValue - Giá trị đơn hàng (VNĐ)
     * @returns {object} Thông tin phí vận chuyển
     */
    calculateShippingFee(orderValue) {
        // Đảm bảo orderValue là số dương
        const value = Math.max(0, parseFloat(orderValue) || 0);
        
        // Tìm mức phí phù hợp
        const tier = this.shippingTiers.find(tier => 
            value >= tier.minAmount && value <= tier.maxAmount
        );

        if (!tier) {
            // Fallback về mức cao nhất nếu không tìm thấy
            return {
                fee: this.shippingTiers[this.shippingTiers.length - 1].fee,
                description: 'Phí vận chuyển mặc định',
                tier: 'default'
            };
        }

        return {
            fee: tier.fee,
            description: tier.description,
            tier: this.getTierName(tier),
            nextTier: this.getNextTierInfo(value)
        };
    }

    /**
     * Lấy tên mức phí
     * @param {object} tier - Mức phí
     * @returns {string} Tên mức phí
     */
    getTierName(tier) {
        if (tier.fee === 0) return 'free';
        if (tier.fee <= 15000) return 'premium';
        if (tier.fee <= 25000) return 'standard';
        if (tier.fee <= 35000) return 'basic';
        return 'economy';
    }

    /**
     * Lấy thông tin mức phí tiếp theo để khuyến khích
     * @param {number} currentValue - Giá trị hiện tại
     * @returns {object|null} Thông tin mức phí tiếp theo
     */
    getNextTierInfo(currentValue) {
        const currentTierIndex = this.shippingTiers.findIndex(tier => 
            currentValue >= tier.minAmount && currentValue <= tier.maxAmount
        );

        if (currentTierIndex === -1 || currentTierIndex >= this.shippingTiers.length - 1) {
            return null;
        }

        const nextTier = this.shippingTiers[currentTierIndex + 1];
        const amountNeeded = nextTier.minAmount - currentValue;

        return {
            amountNeeded: amountNeeded,
            nextFee: nextTier.fee,
            savings: this.shippingTiers[currentTierIndex].fee - nextTier.fee,
            description: `Thêm ${amountNeeded.toLocaleString('vi-VN')}đ để được ${nextTier.description}`
        };
    }

    /**
     * Lấy tất cả các mức phí vận chuyển
     * @returns {array} Danh sách các mức phí
     */
    getAllTiers() {
        return this.shippingTiers.map(tier => ({
            ...tier,
            tierName: this.getTierName(tier)
        }));
    }

    /**
     * Tính tổng tiền đơn hàng bao gồm phí vận chuyển
     * @param {number} subtotal - Tạm tính
     * @param {number} discount - Giảm giá (nếu có)
     * @returns {object} Thông tin tổng tiền
     */
    calculateTotalAmount(subtotal, discount = 0) {
        const subtotalValue = Math.max(0, parseFloat(subtotal) || 0);
        const discountValue = Math.max(0, parseFloat(discount) || 0);
        
        const shippingInfo = this.calculateShippingFee(subtotalValue);
        const totalAmount = subtotalValue + shippingInfo.fee - discountValue;

        return {
            subtotal: subtotalValue,
            shippingFee: shippingInfo.fee,
            discount: discountValue,
            total: totalAmount,
            shippingInfo: shippingInfo
        };
    }
}

// Export instance mặc định
const shippingCalculator = new ShippingCalculator();

module.exports = shippingCalculator; 