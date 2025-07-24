/**
 * Admin Notification System - Unified
 * Hệ thống thông báo thống nhất cho admin panel
 */

class AdminNotifications {
    constructor() {
        this.init();
    }

    init() {
        this.createToastContainer();
        this.setupAjaxDefaults();
        
        // Đảm bảo tương thích với các hàm showToast hiện có
        this.setupGlobalShowToast();
    }

    // Tạo container cho toast notifications
    createToastContainer() {
        if (document.getElementById('toast-container')) return;

        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 space-y-2 max-w-sm';
        document.body.appendChild(container);
    }

    // Cấu hình AJAX mặc định
    setupAjaxDefaults() {
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            fetch.defaults = {
                headers: {
                    'X-CSRF-TOKEN': csrfToken.getAttribute('content')
                }
            };
        }
    }

    // Thiết lập hàm showToast global để tương thích với code hiện có
    setupGlobalShowToast() {
        // Chỉ tạo global showToast nếu chưa có
        if (typeof window.showToast === 'undefined') {
            window.showToast = (message, type = 'success', duration = 5000) => {
                return this.showToast(message, type, duration);
            };
        }
    }

    // Hiển thị toast notification - method chính
    showToast(message, type = 'success', duration = 5000) {
        // Xóa các toast cũ cùng loại để tránh spam
        this.clearToastsByType(type);
        
        const toast = this.createToast(message, type);
        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        // Animation vào
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Tự động ẩn sau duration
        setTimeout(() => {
            this.hideToast(toast);
        }, duration);

        return toast;
    }

    // Xóa các toast cùng loại
    clearToastsByType(type) {
        const container = document.getElementById('toast-container');
        const existingToasts = container.querySelectorAll(`.toast.${type}`);
        existingToasts.forEach(toast => this.hideToast(toast));
    }

    // Tạo toast element với style thống nhất
    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type} transform translate-x-full transition-all duration-300 ease-in-out w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`;

        const typeConfig = {
            success: {
                bgColor: 'bg-green-50',
                textColor: 'text-green-800',
                borderColor: 'border-l-green-500',
                icon: 'ri-check-circle-line text-green-500'
            },
            error: {
                bgColor: 'bg-red-50',
                textColor: 'text-red-800',
                borderColor: 'border-l-red-500',
                icon: 'ri-error-warning-line text-red-500'
            },
            warning: {
                bgColor: 'bg-yellow-50',
                textColor: 'text-yellow-800',
                borderColor: 'border-l-yellow-500',
                icon: 'ri-alert-line text-yellow-500'
            },
            info: {
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-800',
                borderColor: 'border-l-blue-500',
                icon: 'ri-information-line text-blue-500'
            }
        };

        const config = typeConfig[type] || typeConfig.info;

        toast.innerHTML = `
            <div class="p-4 ${config.bgColor} ${config.textColor} border-l-4 ${config.borderColor}">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <i class="${config.icon} text-xl"></i>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium">${message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="toast-close inline-flex text-gray-400 hover:text-gray-600 focus:outline-none" onclick="adminNotifications.hideToast(this.closest('.toast'))">
                            <i class="ri-close-line text-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        return toast;
    }

    // Ẩn toast
    hideToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.add('translate-x-full');
        toast.classList.remove('translate-x-0', 'show');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Xử lý form submit với AJAX
    handleFormSubmit(form, options = {}) {
        const {
            successMessage = 'Lưu thành công!',
            errorMessage = 'Có lỗi xảy ra!',
            onSuccess = null,
            onError = null,
            showLoading = true
        } = options;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (showLoading) {
                this.showLoading(form);
            }

            try {
                const formData = new FormData(form);
                const response = await fetch(form.action, {
                    method: form.method || 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const result = await response.json();

                if (showLoading) {
                    this.hideLoading(form);
                }

                if (result.success) {
                    this.showToast(result.message || successMessage, 'success');
                    if (onSuccess) onSuccess(result);
                    
                    // Redirect nếu có
                    if (result.redirect) {
                        setTimeout(() => {
                            window.location.href = result.redirect;
                        }, 1500);
                    }
                } else {
                    this.showToast(result.message || errorMessage, 'error');
                    if (onError) onError(result);
                }
            } catch (error) {
                if (showLoading) {
                    this.hideLoading(form);
                }
                this.showToast(errorMessage, 'error');
                if (onError) onError(error);
            }
        });
    }

    // Hiển thị loading state
    showLoading(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('data-original-text', submitBtn.innerHTML);
            submitBtn.innerHTML = `
                <i class="ri-loader-4-line animate-spin mr-2"></i>
                Đang xử lý...
            `;
        }
        form.classList.add('form-loading');
    }

    // Ẩn loading state
    hideLoading(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            const originalText = submitBtn.getAttribute('data-original-text') || 'Lưu';
            submitBtn.innerHTML = originalText;
        }
        form.classList.remove('form-loading');
    }

    // Xử lý AJAX request đơn giản
    async makeRequest(url, options = {}) {
        const {
            method = 'GET',
            data = null,
            successMessage = 'Thành công!',
            errorMessage = 'Có lỗi xảy ra!'
        } = options;

        try {
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            const response = await fetch(url, config);
            const result = await response.json();

            if (result.success) {
                this.showToast(result.message || successMessage, 'success');
                return result;
            } else {
                this.showToast(result.message || errorMessage, 'error');
                throw new Error(result.message || errorMessage);
            }
        } catch (error) {
            this.showToast(errorMessage, 'error');
            throw error;
        }
    }

    // Hiển thị thông báo từ flash messages
    showFlashMessages() {
        if (typeof window.flashMessages === 'undefined') return;

        const { success = [], error = [], warning = [], info = [] } = window.flashMessages;

        success.forEach(msg => this.showToast(msg, 'success'));
        error.forEach(msg => this.showToast(msg, 'error'));
        warning.forEach(msg => this.showToast(msg, 'warning'));
        info.forEach(msg => this.showToast(msg, 'info'));
    }

    // Auto-setup cho các form có class 'ajax-form'
    autoSetupForms() {
        document.querySelectorAll('.ajax-form').forEach(form => {
            this.handleFormSubmit(form);
        });
    }
}

// Khởi tạo hệ thống thông báo
const adminNotifications = new AdminNotifications();

// Auto-show flash messages khi trang load
document.addEventListener('DOMContentLoaded', () => {
    adminNotifications.showFlashMessages();
    adminNotifications.autoSetupForms();
});

// Export global để sử dụng trong các file khác
window.adminNotifications = adminNotifications;

// Tương thích với các hàm hiện có
if (typeof window.showToast === 'undefined') {
    window.showToast = (message, type = 'success', duration = 5000) => {
        return adminNotifications.showToast(message, type, duration);
    };
}