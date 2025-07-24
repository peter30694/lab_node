/**
 * Shipping Calculator JavaScript
 * Xử lý tính phí vận chuyển động và cập nhật UI
 */

class ShippingCalculator {
    constructor() {
        this.init();
    }

    init() {
        // Khởi tạo các event listeners
        this.initEventListeners();
        
        // Tính phí vận chuyển ban đầu
        this.updateShippingInfo();
    }

    initEventListeners() {
        // Lắng nghe sự thay đổi trong giỏ hàng
        document.addEventListener('cartUpdated', () => {
            this.updateShippingInfo();
        });

        // Lắng nghe sự thay đổi số lượng sản phẩm
        document.addEventListener('quantityChanged', () => {
            setTimeout(() => {
                this.updateShippingInfo();
            }, 500);
        });
    }

    async updateShippingInfo() {
        try {
            const orderValue = this.getCurrentOrderValue();
            
            if (orderValue <= 0) {
                this.updateShippingDisplay(0, 0, null);
                return;
            }

            const response = await fetch('/calculate-shipping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderValue: orderValue })
            });

            const data = await response.json();
            
            if (data.success) {
                this.updateShippingDisplay(
                    data.shippingInfo.fee,
                    data.totalAmount,
                    data.nextTierInfo
                );
            } else {
                console.error('Lỗi khi tính phí vận chuyển:', data.message);
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật thông tin vận chuyển:', error);
        }
    }

    getCurrentOrderValue() {
        // Lấy giá trị đơn hàng từ các element có thể có
        const subtotalElement = document.querySelector('[data-subtotal]');
        const totalPriceElement = document.querySelector('[data-total-price]');
        
        if (subtotalElement) {
            return parseFloat(subtotalElement.dataset.subtotal) || 0;
        }
        
        if (totalPriceElement) {
            return parseFloat(totalPriceElement.dataset.totalPrice) || 0;
        }

        // Fallback: tính từ các sản phẩm trong giỏ hàng
        const cartItems = document.querySelectorAll('.cart-item');
        let total = 0;
        
        cartItems.forEach(item => {
            const price = parseFloat(item.dataset.price) || 0;
            const quantity = parseInt(item.dataset.quantity) || 0;
            total += price * quantity;
        });

        return total;
    }

    updateShippingDisplay(shippingFee, totalAmount, nextTierInfo) {
        // Cập nhật hiển thị phí vận chuyển
        const shippingFeeElements = document.querySelectorAll('.shipping-fee');
        shippingFeeElements.forEach(element => {
            if (shippingFee === 0) {
                element.innerHTML = '<span class="text-green-600">Miễn phí</span>';
            } else {
                element.textContent = this.formatCurrency(shippingFee);
            }
        });

        // Cập nhật tổng tiền
        const totalAmountElements = document.querySelectorAll('.total-amount');
        totalAmountElements.forEach(element => {
            element.textContent = this.formatCurrency(totalAmount);
        });

        // Cập nhật thông tin khuyến mãi
        this.updatePromotionInfo(nextTierInfo);

        // Cập nhật shipping tier indicator
        this.updateShippingTierIndicator(shippingFee);
    }

    updatePromotionInfo(nextTierInfo) {
        const promotionElement = document.getElementById('shipping-promotion');
        
        if (!promotionElement) return;

        if (nextTierInfo) {
            promotionElement.innerHTML = `
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="ri-gift-line text-green-600"></i>
                        <h6 class="font-semibold text-green-900">Khuyến mãi vận chuyển!</h6>
                    </div>
                    <p class="text-sm text-green-700 mb-2">${nextTierInfo.description}</p>
                    <div class="flex justify-between text-sm">
                        <span class="text-green-600">Tiết kiệm:</span>
                        <span class="font-semibold text-green-900">-${this.formatCurrency(nextTierInfo.savings)}đ</span>
                    </div>
                </div>
            `;
            promotionElement.classList.remove('hidden');
        } else {
            promotionElement.classList.add('hidden');
        }
    }

    updateShippingTierIndicator(shippingFee) {
        // Cập nhật indicator cho mức phí hiện tại
        const tierElements = document.querySelectorAll('.shipping-tier');
        tierElements.forEach(element => {
            const tierFee = parseInt(element.dataset.fee) || 0;
            
            if (tierFee === shippingFee) {
                element.classList.add('bg-blue-100', 'border-blue-300');
                element.classList.remove('bg-white');
            } else {
                element.classList.remove('bg-blue-100', 'border-blue-300');
                element.classList.add('bg-white');
            }
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount);
    }

    // Phương thức để tính phí vận chuyển tĩnh (không gọi API)
    calculateStaticShippingFee(orderValue) {
        const tiers = [
            { min: 0, max: 199999, fee: 50000 },
            { min: 200000, max: 499999, fee: 35000 },
            { min: 500000, max: 999999, fee: 25000 },
            { min: 1000000, max: 1999999, fee: 15000 },
            { min: 2000000, max: Infinity, fee: 0 }
        ];

        const tier = tiers.find(t => orderValue >= t.min && orderValue <= t.max);
        return tier ? tier.fee : 50000;
    }
}

// Khởi tạo shipping calculator khi trang được load
document.addEventListener('DOMContentLoaded', () => {
    window.shippingCalculator = new ShippingCalculator();
});

// Export cho sử dụng trong các file khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShippingCalculator;
} 