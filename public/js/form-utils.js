// Form Utilities - Common form handling for contact and newsletter
class FormUtils {
    constructor() {
        this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.phoneRegex = /^[0-9+\-\s()]+$/;
    }

    // Email validation
    validateEmail(email) {
        if (!email || !email.trim()) {
            return { isValid: false, message: 'Vui lòng nhập email' };
        }
        
        if (!this.emailRegex.test(email.trim())) {
            return { isValid: false, message: 'Email không hợp lệ' };
        }
        
        return { isValid: true, message: '' };
    }

    // Phone validation
    validatePhone(phone) {
        if (!phone || !phone.trim()) {
            return { isValid: true, message: '' }; // Phone is optional
        }
        
        if (!this.phoneRegex.test(phone.trim()) || phone.trim().length < 10) {
            return { isValid: false, message: 'Số điện thoại không hợp lệ' };
        }
        
        return { isValid: true, message: '' };
    }

    // Required field validation
    validateRequired(value, fieldName) {
        if (!value || !value.trim()) {
            return { isValid: false, message: `Vui lòng nhập ${fieldName}` };
        }
        return { isValid: true, message: '' };
    }

    // Show validation message
    showValidationMessage(element, message, type = 'error') {
        // Remove existing messages
        const existingMessage = element.parentElement.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        if (message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `validation-message mt-2 text-sm ${
                type === 'error' ? 'text-red-600' : 'text-green-600'
            }`;
            messageDiv.innerHTML = `
                <div class="flex items-center">
                    <i class="ri-${type === 'error' ? 'error-warning' : 'check'}-line mr-1"></i>
                    <span>${message}</span>
                </div>
            `;
            element.parentElement.appendChild(messageDiv);
        }
    }

    // Clear validation styling
    clearValidation(element) {
        element.classList.remove('border-red-500', 'focus:ring-red-500');
        element.classList.add('border-gray-300', 'focus:ring-blue-500');
        
        const existingMessage = element.parentElement.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    }

    // Show success/error toast
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="ri-${type === 'success' ? 'check' : type === 'error' ? 'error-warning' : 'information'}-line mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="ri-close-line"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, 5000);
    }

    // Handle form submission with loading state
    async handleFormSubmission(form, endpoint, data, options = {}) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang xử lý...';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.message || 'Thành công!', 'success');
                if (options.onSuccess) {
                    options.onSuccess(result);
                }
            } else {
                this.showToast(result.message || 'Có lỗi xảy ra', 'error');
                if (options.onError) {
                    options.onError(result);
                }
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showToast('Có lỗi xảy ra khi gửi form', 'error');
            if (options.onError) {
                options.onError({ message: 'Có lỗi xảy ra khi gửi form' });
            }
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    // Initialize form validation
    initFormValidation(form, validationRules) {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            // Clear validation on input
            input.addEventListener('input', () => {
                this.clearValidation(input);
            });
            
            // Validate on blur
            input.addEventListener('blur', () => {
                this.validateField(input, validationRules);
            });
        });
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isValid = true;
            
            // Validate all fields
            inputs.forEach(input => {
                const fieldValidation = this.validateField(input, validationRules);
                if (!fieldValidation.isValid) {
                    isValid = false;
                }
            });
            
            if (isValid) {
                this.handleFormSubmission(form, form.action, this.getFormData(form), {
                    onSuccess: () => {
                        form.reset();
                    }
                });
            }
        });
    }

    // Validate individual field
    validateField(element, validationRules) {
        const fieldName = element.name;
        const value = element.value;
        const rule = validationRules[fieldName];
        
        if (!rule) {
            return { isValid: true, message: '' };
        }
        
        let validation = { isValid: true, message: '' };
        
        // Required validation
        if (rule.required) {
            validation = this.validateRequired(value, rule.label || fieldName);
        }
        
        // Email validation
        if (validation.isValid && rule.type === 'email' && value) {
            validation = this.validateEmail(value);
        }
        
        // Phone validation
        if (validation.isValid && rule.type === 'phone' && value) {
            validation = this.validatePhone(value);
        }
        
        // Apply styling
        if (validation.isValid) {
            this.clearValidation(element);
        } else {
            element.classList.remove('border-gray-300', 'focus:ring-blue-500');
            element.classList.add('border-red-500', 'focus:ring-red-500');
            this.showValidationMessage(element, validation.message, 'error');
        }
        
        return validation;
    }

    // Get form data as object
    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }
}

// Export for use in other files
window.FormUtils = FormUtils; 