// Modern JavaScript for Pet Store - Optimized Version

document.addEventListener('DOMContentLoaded', function() {
    // Enhanced mobile menu toggle with smooth animations
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            
            if (mobileMenu.classList.contains('hidden')) {
                // Show menu
                mobileMenu.classList.remove('hidden');
                mobileMenu.classList.add('animate-slide-down');
                icon.classList.remove('ri-menu-line');
                icon.classList.add('ri-close-line');
                
                // Prevent body scroll
                document.body.style.overflow = 'hidden';
            } else {
                // Hide menu
                mobileMenu.classList.add('animate-slide-up');
                icon.classList.remove('ri-close-line');
                icon.classList.add('ri-menu-line');
                
                // Allow body scroll
                document.body.style.overflow = '';
                
                setTimeout(() => {
                    mobileMenu.classList.add('hidden');
                    mobileMenu.classList.remove('animate-slide-up');
                }, 300);
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenuBtn.click();
                }
            }
        });
    }
    
    // Global function to close mobile menu
    window.closeMobileMenu = function() {
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.click();
        }
    };
    
    // Radio button interactions for forms
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            const groupName = this.name;
            const groupRadios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
            
            groupRadios.forEach(rb => {
                const indicator = rb.parentElement.querySelector('div:last-child');
                if (indicator) {
                    indicator.classList.add('opacity-0');
                }
            });
            
            if (this.checked) {
                const indicator = this.parentElement.querySelector('div:last-child');
                if (indicator) {
                    indicator.classList.remove('opacity-0');
                }
            }
        });
    });
    
    // Checkbox interactions for forms
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const box = this.parentElement.querySelector('div:nth-child(2)');
            const check = this.parentElement.querySelector('div:last-child');
            
            if (this.checked) {
                if (box) {
                    box.classList.remove('border-gray-300');
                    box.classList.add('border-primary', 'bg-primary');
                }
                if (check) {
                    check.classList.remove('opacity-0');
                }
            } else {
                if (box) {
                    box.classList.add('border-gray-300');
                    box.classList.remove('border-primary', 'bg-primary');
                }
                if (check) {
                    check.classList.add('opacity-0');
                }
            }
        });
    });
    
    // Password visibility toggle
    const passwordToggles = document.querySelectorAll('button[class*="absolute right-3"]');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('ri-eye-line');
                    icon.classList.add('ri-eye-off-line');
                } else {
                    input.type = 'password';
                    icon.classList.remove('ri-eye-off-line');
                    icon.classList.add('ri-eye-line');
                }
            }
        });
    });
    
    // Modern toast notifications - Global function
    window.showToast = function(message, type = 'success') {
        // Remove existing toasts to prevent stacking
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <i class="ri-${type === 'success' ? 'check' : type === 'error' ? 'close' : 'information'}-circle-line text-lg"></i>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-900">${message}</p>
                </div>
                <div class="ml-auto pl-3">
                    <button class="inline-flex text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, 5000);
    };
    
    // Add to cart functionality with loading states
    window.addToCart = function(productId, quantity = 1, buttonElement = null) {
        // Prevent multiple clicks during processing
        if (buttonElement && (buttonElement.disabled || buttonElement.classList.contains('processing'))) {
            return;
        }
        
        // Store original HTML and state
        let originalHTML = '';
        let originalClasses = '';
        
        if (buttonElement) {
            originalHTML = buttonElement.innerHTML;
            originalClasses = buttonElement.className;
            buttonElement.disabled = true;
            buttonElement.classList.add('processing', 'opacity-75', 'cursor-not-allowed');
            buttonElement.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        }

        fetch('/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ productId, quantity })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Đã thêm sản phẩm vào giỏ hàng', 'success');
                updateCartCount(data.cartCount);
                
                            // Restore button state immediately after success
            if (buttonElement) {
                // Restore immediately without checkmark delay
                buttonElement.innerHTML = originalHTML;
                buttonElement.className = originalClasses;
                buttonElement.disabled = false;
                buttonElement.removeAttribute('disabled');
                buttonElement.classList.remove('processing');
            }
            } else {
                showToast(data.message || 'Có lỗi xảy ra', 'error');
                if (buttonElement) {
                    buttonElement.innerHTML = originalHTML;
                    buttonElement.className = originalClasses;
                    buttonElement.disabled = false;
                    buttonElement.removeAttribute('disabled');
                    buttonElement.classList.remove('processing');
                }
            }
        })
        .catch(error => {
            showToast('Có lỗi xảy ra khi thêm sản phẩm', 'error');
            if (buttonElement) {
                buttonElement.innerHTML = originalHTML;
                buttonElement.className = originalClasses;
                buttonElement.disabled = false;
                buttonElement.removeAttribute('disabled');
                buttonElement.classList.remove('processing');
            }
        });
    };
    
    // Update cart count badges
    function updateCartCount(count) {
        const cartLinks = document.querySelectorAll('a[href="/cart"]');
        cartLinks.forEach(link => {
            let badge = link.querySelector('div span');
            
            // Nếu chưa có badge và count > 0, tạo badge mới
            if (!badge && count > 0) {
                const div = link.querySelector('div');
                if (div) {
                    badge = document.createElement('span');
                    badge.className = 'absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-lg border-2 border-white transform scale-100 group-hover:scale-110 transition-all duration-300';
                    div.appendChild(badge);
                }
            }
            
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
    }
    
    // Update favorites count badges
    function updateFavoritesCount(count) {
        const favoritesLinks = document.querySelectorAll('a[href="/favorites"]');
        favoritesLinks.forEach(link => {
            let badge = link.querySelector('div span');
            
            // Nếu chưa có badge và count > 0, tạo badge mới
            if (!badge && count > 0) {
                const div = link.querySelector('div');
                if (div) {
                    badge = document.createElement('span');
                    badge.className = 'absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-lg border-2 border-white transform scale-100 group-hover:scale-110 transition-all duration-300';
                    div.appendChild(badge);
                }
            }
            
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
    }
    
    // Toggle favorite functionality
    window.toggleFavorite = async function(productId, buttonElement) {
        // Kiểm tra đăng nhập trước khi gửi request
        if (typeof isAuthenticated !== 'undefined' && !isAuthenticated) {
            window.location.href = '/auth/login';
            return;
        }
        try {
            if (!buttonElement) {
                showToast('Có lỗi xảy ra', 'error');
                return;
            }
            
            // Disable button to prevent double click
            buttonElement.disabled = true;
            const originalHTML = buttonElement.innerHTML;
            
            // Kiểm tra loại nút để hiển thị loading phù hợp
            if (
                buttonElement.classList.contains('w-8') ||
                buttonElement.classList.contains('h-8') ||
                buttonElement.classList.contains('w-10') ||
                buttonElement.classList.contains('h-10')
            ) {
                // Nút tròn nhỏ trên thẻ sản phẩm - chỉ hiển thị loading icon
                buttonElement.innerHTML = '<i class="ri-loader-4-line animate-spin text-lg"></i>';
            } else {
                // Nút lớn trong chi tiết sản phẩm - hiển thị cả loading icon và text
                buttonElement.innerHTML = '<i class="ri-loader-4-line animate-spin"></i><span>Đang xử lý...</span>';
            }
            
            const response = await fetch('/favorites/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ productId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Nếu đang ở trang favorites và vừa bỏ yêu thích thì xóa card khỏi DOM
                if (window.location.pathname === '/favorites' && data.isFavorite === false) {
                    const productCard = buttonElement.closest('[data-product-id]');
                    if (productCard) {
                        productCard.style.transform = 'scale(0.8)';
                        productCard.style.opacity = '0';
                        setTimeout(() => {
                            productCard.remove();
                            // Kiểm tra nếu hết sản phẩm thì hiện empty-favorites
                            const favoritesGrid = document.getElementById('favorites-grid');
                            const emptyFavorites = document.getElementById('empty-favorites');
                            const favoritesHeader = document.getElementById('favorites-header');
                            const clearAllBtn = document.getElementById('clear-all-favorites-btn');
                            const favoritesCount = document.getElementById('favorites-count-badge');
                            const productCards = favoritesGrid ? favoritesGrid.querySelectorAll('[data-product-id]') : [];
                            if (favoritesGrid && productCards.length === 0) {
                                if (favoritesGrid) favoritesGrid.style.display = 'none';
                                if (favoritesHeader) favoritesHeader.style.display = 'none';
                                if (clearAllBtn) clearAllBtn.style.display = 'none';
                                if (favoritesCount) favoritesCount.textContent = '0 sản phẩm';
                                if (emptyFavorites) {
                                    emptyFavorites.style.display = 'block';
                                    emptyFavorites.style.animation = 'fadeIn 0.5s ease-in-out';
                                }
                            }
                        }, 300);
                    }
                    updateFavoritesCount(data.favoritesCount);
                    showToast('Đã bỏ yêu thích sản phẩm', 'success');
                    return;
                }
                // Cập nhật trạng thái nút dựa trên response
                if (data.isFavorite) {
                    // Đã thêm vào yêu thích
                    buttonElement.setAttribute('data-favorited', 'true');
                    // Kiểm tra loại nút để cập nhật phù hợp
                    if (
                        buttonElement.classList.contains('w-8') ||
                        buttonElement.classList.contains('h-8') ||
                        buttonElement.classList.contains('w-10') ||
                        buttonElement.classList.contains('h-10')
                    ) {
                        // Nút tròn nhỏ trên thẻ sản phẩm - chỉ cập nhật icon
                        buttonElement.innerHTML = '<i class="ri-heart-fill text-red-500 text-lg"></i>';
                    } else {
                        // Nút lớn trong chi tiết sản phẩm - cập nhật cả icon và text
                        buttonElement.innerHTML = '<i class="ri-heart-fill"></i><span>Đã yêu thích</span>';
                    }
                    showToast('Đã thêm vào yêu thích', 'success');
                } else {
                    // Đã xóa khỏi yêu thích
                    buttonElement.setAttribute('data-favorited', 'false');
                    // Kiểm tra loại nút để cập nhật phù hợp
                    if (
                        buttonElement.classList.contains('w-8') ||
                        buttonElement.classList.contains('h-8') ||
                        buttonElement.classList.contains('w-10') ||
                        buttonElement.classList.contains('h-10')
                    ) {
                        // Nút tròn nhỏ trên thẻ sản phẩm - chỉ cập nhật icon
                        buttonElement.innerHTML = '<i class="ri-heart-line text-gray-600 group-hover:text-red-500 text-lg transition-colors duration-200"></i>';
                    } else {
                        // Nút lớn trong chi tiết sản phẩm - cập nhật cả icon và text
                        buttonElement.innerHTML = '<i class="ri-heart-line"></i><span>Yêu thích</span>';
                    }
                    showToast('Đã xóa khỏi yêu thích', 'info');
                }
                
                updateFavoritesCount(data.favoritesCount);
            } else {
                showToast(data.message || 'Có lỗi xảy ra', 'error');
                // Restore original state on error
                buttonElement.innerHTML = originalHTML;
            }
        } catch (error) {
            showToast('Có lỗi xảy ra', 'error');
            // Restore original state on error
            buttonElement.innerHTML = originalHTML;
        } finally {
            // Re-enable button
            buttonElement.disabled = false;
        }
    };
    
    // Newsletter subscription - Handle both forms with double submission prevention
    const newsletterForms = document.querySelectorAll('#newsletter-form, #footer-newsletter-form');
    newsletterForms.forEach(form => {
        // Add flag to prevent double submission
        let isSubmitting = false;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Prevent double submission
            if (isSubmitting) {
                console.log('Newsletter form submission already in progress');
                return;
            }
            
            const emailInput = this.querySelector('input[name="email"]');
            const submitBtn = this.querySelector('button[type="submit"]');
            const email = emailInput.value.trim();
            
            // Validate email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                showToast('Vui lòng nhập email', 'error');
                emailInput.focus();
                return;
            }
            
            if (!emailRegex.test(email)) {
                showToast('Email không hợp lệ', 'error');
                emailInput.focus();
                return;
            }
            
            // Set submitting flag
            isSubmitting = true;
            
            // Store original button state
            const originalBtnHTML = submitBtn.innerHTML;
            const originalBtnClasses = submitBtn.className;
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang xử lý...';
            submitBtn.className = originalBtnClasses + ' opacity-75 cursor-not-allowed';
            
            try {
                console.log('Sending newsletter subscription request for email:', email);
                
                const response = await fetch('/newsletter/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast('Đăng ký newsletter thành công!', 'success');
                    this.reset();
                } else {
                    showToast(data.message || 'Có lỗi xảy ra khi đăng ký', 'error');
                }
            } catch (error) {
                console.error('Newsletter subscription error:', error);
                showToast('Có lỗi xảy ra khi đăng ký newsletter', 'error');
            } finally {
                // Reset submitting flag
                isSubmitting = false;
                
                // Restore button state
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
                submitBtn.className = originalBtnClasses;
            }
        });
    });
    
    // Smooth scroll for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            const target = document.querySelector(href);
            
            if (target) {
                // Calculate offset for fixed header
                const headerHeight = document.querySelector('header')?.offsetHeight || 0;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    if (images.length > 0) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Add loading state
                    img.classList.add('opacity-50');
                    
                    // Load image
                    img.src = img.dataset.src;
                    img.onload = function() {
                        img.classList.remove('opacity-0', 'opacity-50');
                        img.classList.add('opacity-100');
                    };
                    img.onerror = function() {
                        img.classList.remove('opacity-50');
                        img.classList.add('opacity-100');
                        // Fallback to default image if available
                        if (img.dataset.fallback) {
                            img.src = img.dataset.fallback;
                        }
                    };
                    
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px', // Start loading 50px before image comes into view
            threshold: 0.1
        });
        
        images.forEach(img => {
            img.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            imageObserver.observe(img);
        });
    }
    
    // Form validation enhancement - Exclude newsletter, contact, and checkout forms
    const forms = document.querySelectorAll('form:not(#newsletter-form):not(#footer-newsletter-form):not(#contact-form):not(#checkoutForm)');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            // Clear previous error styling
            form.querySelectorAll('.border-red-500').forEach(field => {
                field.classList.remove('border-red-500', 'focus:ring-red-500');
                field.classList.add('border-gray-300', 'focus:ring-blue-500');
            });
            
            requiredFields.forEach(field => {
                const value = field.value.trim();
                const fieldType = field.type;
                
                let isFieldValid = true;
                
                // Check if field is empty
                if (!value) {
                    isFieldValid = false;
                }
                
                // Additional validation for specific field types
                if (fieldType === 'email' && value) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value)) {
                        isFieldValid = false;
                    }
                }
                
                if (fieldType === 'tel' && value) {
                    const phoneRegex = /^[0-9+\-\s()]+$/;
                    if (!phoneRegex.test(value) || value.length < 10) {
                        isFieldValid = false;
                    }
                }
                
                if (!isFieldValid) {
                    isValid = false;
                    field.classList.remove('border-gray-300', 'focus:ring-blue-500');
                    field.classList.add('border-red-500', 'focus:ring-red-500');
                    
                    // Add focus effect
                    field.focus();
                    
                    // Remove error styling after user starts typing
                    field.addEventListener('input', function() {
                        this.classList.remove('border-red-500', 'focus:ring-red-500');
                        this.classList.add('border-gray-300', 'focus:ring-blue-500');
                    }, { once: true });
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
                return;
            }
            
            // Disable submit button to prevent double submission
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang xử lý...';
                
                // Re-enable button after 5 seconds if form doesn't submit
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }, 5000);
            }
        });
    });
    
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert, .alert-success, .alert-error, .alert-warning, .alert-info');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 5000);
    });
    
    // Initialize tooltips if any
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg';
            tooltip.textContent = this.dataset.tooltip;
            
            // Calculate position to avoid overflow
            const rect = this.getBoundingClientRect();
            const tooltipWidth = 200; // Approximate tooltip width
            const tooltipHeight = 30; // Approximate tooltip height
            
            let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            let top = rect.top - tooltipHeight - 5;
            
            // Adjust if tooltip would overflow left
            if (left < 10) {
                left = 10;
            }
            
            // Adjust if tooltip would overflow right
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = window.innerWidth - tooltipWidth - 10;
            }
            
            // Adjust if tooltip would overflow top
            if (top < 10) {
                top = rect.bottom + 5;
            }
            
            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            
            document.body.appendChild(tooltip);
            this.tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.tooltip) {
                this.tooltip.remove();
                this.tooltip = null;
            }
        });
    });
});

// ===== KIỂM TRA TỒN KHO REAL-TIME =====
function checkStockAvailability(productId, quantity, callback) {
    fetch('/check-stock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            productId: productId,
            quantity: quantity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (callback) {
            callback(data);
        }
    })
    .catch(error => {
        console.error('Lỗi khi kiểm tra tồn kho:', error);
        if (callback) {
            callback({ success: false, message: 'Có lỗi xảy ra khi kiểm tra tồn kho' });
        }
    });
}

// Kiểm tra tồn kho khi thay đổi số lượng trong trang chi tiết sản phẩm
function updateQuantityWithStockCheck(productId, newQuantity) {
    const quantityInput = document.getElementById('quantity');
    const addToCartBtn = document.getElementById('addToCartOnlyBtn');
    const stockStatus = document.getElementById('stockStatus');
    
    if (!quantityInput || !addToCartBtn) return;
    
    // Disable button trong khi kiểm tra
    addToCartBtn.disabled = true;
    addToCartBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang kiểm tra...';
    
    checkStockAvailability(productId, newQuantity, (result) => {
        if (result.success && result.available) {
            // Tồn kho đủ
            quantityInput.classList.remove('border-red-500');
            quantityInput.classList.add('border-gray-200');
            addToCartBtn.disabled = false;
            addToCartBtn.innerHTML = '<i class="ri-shopping-cart-line text-base"></i><span>Thêm vào giỏ</span>';
            
            if (stockStatus) {
                stockStatus.innerHTML = `<span class="text-green-600 font-semibold">Còn ${result.currentStock} sản phẩm</span>`;
                stockStatus.className = 'text-sm text-gray-700';
            }
        } else {
            // Tồn kho không đủ
            quantityInput.classList.remove('border-gray-200');
            quantityInput.classList.add('border-red-500');
            addToCartBtn.disabled = true;
            addToCartBtn.innerHTML = '<i class="ri-close-circle-line text-base"></i><span>Hết hàng</span>';
            
            if (stockStatus) {
                stockStatus.innerHTML = `<span class="text-red-600 font-semibold">Chỉ còn ${result.currentStock || 0} sản phẩm</span>`;
                stockStatus.className = 'text-sm text-red-600';
            }
            
            // Hiển thị thông báo
            showToast(result.message || 'Số lượng vượt quá tồn kho', 'error');
        }
    });
}

// Kiểm tra tồn kho cho giỏ hàng
function checkCartStock(cartItems, callback) {
    fetch('/check-cart-stock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            cartItems: cartItems
        })
    })
    .then(response => response.json())
    .then(data => {
        if (callback) {
            callback(data);
        }
    })
    .catch(error => {
        console.error('Lỗi khi kiểm tra tồn kho giỏ hàng:', error);
        if (callback) {
            callback({ success: false, message: 'Có lỗi xảy ra khi kiểm tra tồn kho' });
        }
    });
}

// Thêm event listener cho input số lượng
document.addEventListener('DOMContentLoaded', function() {
    const quantityInput = document.getElementById('quantity');
    const productId = document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
    
    if (quantityInput && productId) {
        quantityInput.addEventListener('change', function() {
            const newQuantity = parseInt(this.value) || 1;
            updateQuantityWithStockCheck(productId, newQuantity);
        });
        
        quantityInput.addEventListener('input', function() {
            const newQuantity = parseInt(this.value) || 1;
            updateQuantityWithStockCheck(productId, newQuantity);
        });
    }
    
    // Kiểm tra tồn kho khi load trang
    if (productId) {
        const initialQuantity = parseInt(quantityInput?.value) || 1;
        updateQuantityWithStockCheck(productId, initialQuantity);
    }
});

// ===== KIỂM TRA TRẠNG THÁI ĐƠN HÀNG REAL-TIME =====
function checkOrderStatus(orderId, callback) {
    fetch(`/order-status/${orderId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (callback) {
            callback(data);
        }
    })
    .catch(error => {
        console.error('Lỗi khi kiểm tra trạng thái đơn hàng:', error);
        if (callback) {
            callback({ success: false, message: 'Có lỗi xảy ra khi kiểm tra trạng thái đơn hàng' });
        }
    });
}

// Auto-refresh trạng thái đơn hàng
function startOrderStatusPolling(orderId, interval = 30000) { // 30 giây
    const statusElement = document.getElementById('orderStatus');
    const paymentStatusElement = document.getElementById('paymentStatus');
    
    if (!statusElement && !paymentStatusElement) {
        console.warn('Không tìm thấy element hiển thị trạng thái đơn hàng');
        return;
    }
    
    const pollInterval = setInterval(() => {
        checkOrderStatus(orderId, (data) => {
            if (data.success) {
                const order = data.order;
                
                // Cập nhật trạng thái đơn hàng
                if (statusElement) {
                    statusElement.textContent = getStatusText(order.status);
                    statusElement.className = getStatusClass(order.status);
                }
                
                // Cập nhật trạng thái thanh toán
                if (paymentStatusElement) {
                    paymentStatusElement.textContent = getPaymentStatusText(order.paymentStatus);
                    paymentStatusElement.className = getPaymentStatusClass(order.paymentStatus);
                }
                
                // Dừng polling nếu đơn hàng đã hoàn thành hoặc hủy
                if (['delivered', 'cancelled'].includes(order.status)) {
                    clearInterval(pollInterval);
                    console.log('Đã dừng polling trạng thái đơn hàng');
                }
            }
        });
    }, interval);
    
    return pollInterval;
}

// Helper functions để hiển thị trạng thái
function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ xử lý',
        'confirmed': 'Đã xác nhận',
        'shipping': 'Đang giao',
        'delivered': 'Đã giao',
        'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'pending': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        'confirmed': 'bg-blue-100 text-blue-800 border border-blue-200',
        'shipping': 'bg-purple-100 text-purple-800 border border-purple-200',
        'delivered': 'bg-green-100 text-green-800 border border-green-200',
        'cancelled': 'bg-red-100 text-red-800 border border-red-200'
    };
    return classMap[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
}

function getPaymentStatusText(paymentStatus) {
    const paymentStatusMap = {
        'pending': 'Chờ thanh toán',
        'paid': 'Đã thanh toán',
        'failed': 'Thanh toán thất bại',
        'refunded': 'Đã hoàn tiền',
        'processing': 'Đang xử lý'
    };
    return paymentStatusMap[paymentStatus] || paymentStatus;
}

function getPaymentStatusClass(paymentStatus) {
    const paymentClassMap = {
        'pending': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        'paid': 'bg-green-100 text-green-800 border border-green-200',
        'failed': 'bg-red-100 text-red-800 border border-red-200',
        'refunded': 'bg-gray-100 text-gray-800 border border-gray-200',
        'processing': 'bg-blue-100 text-blue-800 border border-blue-200'
    };
    return paymentClassMap[paymentStatus] || 'bg-gray-100 text-gray-800 border border-gray-200';
}
