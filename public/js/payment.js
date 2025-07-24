// Payment JavaScript - Optimized Version

document.addEventListener('DOMContentLoaded', function () {
    // Hiển thị chi tiết COD ban đầu
    showPaymentDetails('cod');

    // Xử lý thay đổi phương thức thanh toán
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(method => {
        method.addEventListener('change', updatePaymentSelection);
    });

    function showPaymentDetails(method) {
        // Ẩn tất cả chi tiết thanh toán
        const allDetails = document.querySelectorAll('.payment-detail');
        allDetails.forEach(detail => {
            detail.style.display = 'none';
        });

        // Hiển thị chi tiết của phương thức được chọn
        const selectedDetail = document.getElementById(method + '-details');
        if (selectedDetail) {
            selectedDetail.style.display = 'block';
        }
    }

    function updatePaymentSelection() {
        const selectedMethod = this.value;

        // Hiển thị chi tiết thanh toán tương ứng
        showPaymentDetails(selectedMethod);

        // Cập nhật visual selection
        updateCardSelection(this);
    }

    function updateCardSelection(selectedInput) {
        // Reset tất cả card
        const allCards = document.querySelectorAll('.payment-card');
        allCards.forEach(card => {
            card.classList.remove('selected');
        });

        // Highlight card được chọn
        if (selectedInput && typeof selectedInput.closest === 'function') {
            const selectedCard = selectedInput.closest('.payment-card');
            if (selectedCard) {
                selectedCard.classList.add('selected');
            }
        } else {
            // Fallback: tìm parent element
            let parent = selectedInput;
            while (parent && parent.parentElement) {
                parent = parent.parentElement;
                if (parent.classList && parent.classList.contains('payment-card')) {
                    parent.classList.add('selected');
                    break;
                }
            }
        }
    }

    // Xử lý click vào card để chọn radio button
    const paymentCards = document.querySelectorAll('.payment-method');
    paymentCards.forEach(card => {
        card.addEventListener('click', function () {
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        });
    });

    function validatePaymentMethod() {
        // Lấy từ select thay vì radio
        const paymentSelect = document.getElementById('paymentMethod');
        const paymentMethod = paymentSelect ? paymentSelect.value : null;

        if (!paymentMethod) {
            alert('Vui lòng chọn phương thức thanh toán!');
            return false;
        }

        if (paymentMethod !== 'cod' && paymentMethod !== 'vnpay') {
            alert('Phương thức thanh toán không hợp lệ!');
            return false;
        }

        return true;
    }

    // Khởi tạo trạng thái ban đầu
    const defaultSelected = document.querySelector('input[name="paymentMethod"]:checked');
    if (defaultSelected && defaultSelected.value === 'cod') {
        updatePaymentSelection.call(defaultSelected);
    }

    // Xử lý submit form
    window.processOrder = function () {
        const form = document.getElementById('checkoutForm');
        const formData = new FormData(form);
        const paymentSelect = document.getElementById('paymentMethod');
        const paymentMethod = paymentSelect ? paymentSelect.value : null;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        if (!validatePaymentMethod()) {
            return;
        }

        const orderData = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            address: formData.get('address'),
            note: formData.get('note'),
            paymentMethod: paymentMethod,
            // Thêm thông tin mã giảm giá
            couponCode: formData.get('couponCode'),
            couponDiscount: formData.get('couponDiscount'),
            couponId: formData.get('couponId'),
            couponValid: formData.get('couponValid')
        };

        // Tìm button submit - có thể ở trong form hoặc ngoài form với form attribute
        let button = form.querySelector('button[type="submit"]');
        if (!button) {
            // Tìm button bên ngoài form có form="checkoutForm"
            button = document.querySelector('button[form="checkoutForm"]');
        }
        
        if (!button) {
            alert('Không tìm thấy nút đặt hàng!');
            return;
        }
        
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang xử lý...';
        button.disabled = true;

        // Luôn gọi /orders cho cả hai phương thức
        fetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.redirectUrl) {
                // Hiển thị thông báo trước khi redirect
                if (data.paymentMethod === 'vnpay') {
                    if (typeof showToast === 'function') {
                        showToast('Đang chuyển hướng đến VNPay...', 'info');
                    }
                    // Delay một chút để user thấy thông báo
                    setTimeout(() => {
                        window.location.href = data.redirectUrl;
                    }, 1000);
                } else {
                    window.location.href = data.redirectUrl;
                }
            } else {
                // Hiển thị thông báo lỗi chi tiết
                let errorMessage = data.message || 'Có lỗi xảy ra khi đặt hàng';
                
                // Xử lý lỗi trùng lặp đơn hàng
                if (data.errorType === 'duplicate_order') {
                    errorMessage = 'Bạn đã đặt đơn hàng tương tự gần đây. Vui lòng kiểm tra đơn hàng của bạn hoặc chờ một chút rồi thử lại.';
                    
                    // Hiển thị thông báo đặc biệt cho lỗi trùng lặp
                    if (typeof showToast === 'function') {
                        showToast(errorMessage, 'warning');
                    } else {
                        alert(errorMessage);
                    }
                    
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                
                // Nếu có lỗi validation cụ thể, highlight field đó
                if (data.field) {
                    const field = document.getElementById(data.field);
                    if (field) {
                        field.focus();
                        field.classList.add('border-red-500');
                        setTimeout(() => {
                            field.classList.remove('border-red-500');
                        }, 3000);
                    }
                }
                
                // Hiển thị thông báo lỗi
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                } else {
                    alert(errorMessage);
                }
                
                button.innerHTML = originalText;
                button.disabled = false;
            }
        })
        .catch(error => {
            console.error('Lỗi khi đặt hàng:', error);
            const errorMessage = 'Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại sau.';
            
            if (typeof showToast === 'function') {
                showToast(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }
            
            button.innerHTML = originalText;
            button.disabled = false;
        });
    };
});