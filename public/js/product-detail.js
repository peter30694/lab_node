// Product Detail JavaScript - Optimized Version

// Global functions for reuse
// Note: toggleFavorite function is defined in main.js to avoid conflicts

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

document.addEventListener('DOMContentLoaded', function() {
    // Star rating functionality
    function setRating(rating) {
        const stars = document.querySelectorAll('#starRating i');
        const ratingInput = document.getElementById('ratingInput');
        const ratingText = document.getElementById('ratingText');
        
        // Cập nhật hiển thị sao
        stars.forEach((star, index) => {
            star.className = index < rating 
                ? 'ri-star-fill cursor-pointer hover:text-yellow-500 transition-colors'
                : 'ri-star-line cursor-pointer hover:text-yellow-500 transition-colors';
        });
        
        // Cập nhật input và text
        ratingInput.value = rating;
        const ratingLabels = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'];
        ratingText.textContent = ratingLabels[rating] || 'Chọn số sao';
    }

    function resetStarRating() {
        const stars = document.querySelectorAll('#starRating i');
        const ratingInput = document.getElementById('ratingInput');
        const ratingText = document.getElementById('ratingText');
        
        stars.forEach((star, index) => {
            star.className = 'ri-star-line cursor-pointer hover:text-yellow-500 transition-colors';
            star.onclick = () => setRating(index + 1);
        });
        
        ratingInput.value = '';
        ratingText.textContent = 'Chọn số sao';
    }

    // Hover effect cho sao
    const stars = document.querySelectorAll('#starRating i');
    if (stars.length > 0) {
        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', function() {
                const rating = index + 1;
                stars.forEach((s, i) => {
                    s.className = i < rating 
                        ? 'ri-star-fill cursor-pointer hover:text-yellow-500 transition-colors'
                        : 'ri-star-line cursor-pointer hover:text-yellow-500 transition-colors';
                });
            });
            
            star.addEventListener('mouseleave', function() {
                const currentRating = document.getElementById('ratingInput').value;
                if (currentRating) {
                    setRating(parseInt(currentRating));
                } else {
                    resetStarRating();
                }
            });
        });
    }

    // Review form functionality
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const rating = document.getElementById('ratingInput').value;
            const comment = document.getElementById('comment').value;
            const productId = document.querySelector('input[name="productId"]').value;
            
            // ===== VALIDATION CLIENT-SIDE =====
            if (!rating) {
                showToast('Vui lòng chọn số sao đánh giá', 'error');
                return;
            }
            
            if (!comment.trim()) {
                showToast('Vui lòng nhập bình luận', 'error');
                return;
            }
            
            if (comment.trim().length < 10) {
                showToast('Nội dung đánh giá phải có ít nhất 10 ký tự', 'error');
                return;
            }
            
            if (comment.trim().length > 1000) {
                showToast('Nội dung đánh giá không được quá 1000 ký tự', 'error');
                return;
            }
            
            const submitBtn = document.getElementById('submitReviewBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang gửi...';
            
            fetch('/reviews/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    productId: productId,
                    rating: parseInt(rating),
                    comment: comment.trim()
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || 'Lỗi server');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showToast('Đánh giá của bạn đã được gửi thành công!', 'success');
                    
                    // Reset form
                    resetStarRating();
                    document.getElementById('comment').value = '';
                    
                    // Reload page sau 2 giây để hiển thị đánh giá mới
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    showToast(data.message || 'Có lỗi xảy ra khi gửi đánh giá', 'error');
                }
            })
            .catch(error => {
                // Xử lý các loại lỗi khác nhau
                if (error.message && error.message.includes('đăng nhập')) {
                    showToast('Bạn cần đăng nhập để gửi đánh giá. Đang chuyển hướng...', 'warning');
                    setTimeout(() => {
                        window.location.href = '/auth/login';
                    }, 2000);
                } else if (error.message && error.message.includes('đã đánh giá')) {
                    showToast('Bạn đã đánh giá sản phẩm này rồi', 'warning');
                } else if (error.message && error.message.includes('Giới hạn')) {
                    showToast(error.message, 'warning');
                } else {
                    showToast('Có lỗi xảy ra khi gửi đánh giá: ' + error.message, 'error');
                }
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="ri-send-plane-line"></i> Gửi đánh giá';
            });
        });
        
        // ===== REAL-TIME VALIDATION =====
        const commentInput = document.getElementById('comment');
        const charCount = document.createElement('div');
        charCount.className = 'text-xs text-gray-500 mt-1';
        commentInput.parentNode.appendChild(charCount);
        
        commentInput.addEventListener('input', function() {
            const length = this.value.length;
            charCount.textContent = `${length}/1000 ký tự`;
            
            if (length < 10) {
                charCount.className = 'text-xs text-red-500 mt-1';
            } else if (length > 900) {
                charCount.className = 'text-xs text-yellow-500 mt-1';
            } else {
                charCount.className = 'text-xs text-gray-500 mt-1';
            }
        });
    }

    // Quantity controls
    const quantityInput = document.getElementById('quantity');
    const decreaseBtn = document.getElementById('decreaseBtn');
    const increaseBtn = document.getElementById('increaseBtn');
    const addToCartBtn = document.getElementById('addToCartOnlyBtn');

    if (decreaseBtn && increaseBtn && quantityInput) {
        // Khởi tạo trạng thái nút
        function updateButtonStates() {
            const currentValue = parseInt(quantityInput.value);
            const maxValue = parseInt(quantityInput.getAttribute('max'));
            
            decreaseBtn.disabled = currentValue <= 1;
            increaseBtn.disabled = currentValue >= maxValue;
            
            // CSS classes sẽ tự động được áp dụng thông qua :disabled pseudo-class
            // Không cần thêm/xóa classes thủ công
        }
        
        // Khởi tạo trạng thái ban đầu
        updateButtonStates();
        
        decreaseBtn.addEventListener('click', function () {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
                updateButtonStates();
            }
        });

        increaseBtn.addEventListener('click', function () {
            let currentValue = parseInt(quantityInput.value);
            const maxValue = parseInt(quantityInput.getAttribute('max'));
            if (currentValue < maxValue) {
                quantityInput.value = currentValue + 1;
                updateButtonStates();
            }
        });
        
        // Cập nhật trạng thái khi người dùng nhập trực tiếp
        quantityInput.addEventListener('input', updateButtonStates);
    }

    // Add to cart functionality - Removed duplicate event listener
    // The addToCart function from main.js handles this functionality
    // No need for additional event listener here

    // Image gallery functionality
    const mainImage = document.querySelector('.main-image');
    const thumbnailImages = document.querySelectorAll('.thumbnail-image');
    
    if (mainImage && thumbnailImages.length > 0) {
        thumbnailImages.forEach(thumbnail => {
            thumbnail.addEventListener('click', function() {
                const newSrc = this.getAttribute('data-src');
                if (newSrc) {
                    mainImage.src = newSrc;
                    
                    // Update active thumbnail
                    thumbnailImages.forEach(t => t.classList.remove('ring-2', 'ring-blue-500'));
                    this.classList.add('ring-2', 'ring-blue-500');
                }
            });
        });
    }

    // Review display functionality
    const reviewsContainer = document.getElementById('reviewsContainer');
    if (reviewsContainer) {
        // Load reviews if they exist
        const reviews = JSON.parse(reviewsContainer.getAttribute('data-reviews') || '[]');
        reviews.forEach(review => {
            const reviewElement = createReviewElement(review);
            reviewsContainer.appendChild(reviewElement);
        });
    }
});

// Create review element function
function createReviewElement(review) {
    const reviewDiv = document.createElement('div');
    reviewDiv.className = 'bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-100';
    
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    
    reviewDiv.innerHTML = `
        <div class="flex items-start space-x-3">
            <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-lg">
                ${review.userName.charAt(0).toUpperCase()}
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                    <h6 class="font-semibold text-gray-900">${review.userName}</h6>
                    <div class="flex items-center space-x-1">
                        <span class="text-yellow-400 text-sm">${stars}</span>
                        <span class="text-gray-500 text-sm">${review.rating}/5</span>
                    </div>
                </div>
                <p class="text-gray-600 text-sm mb-2">${review.comment}</p>
                <div class="text-xs text-gray-400">
                    ${new Date(review.createdAt).toLocaleDateString('vi-VN')}
                </div>
            </div>
        </div>
    `;
    
    return reviewDiv;
}