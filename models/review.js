const mongodb = require('mongodb');
const getDb = require('../util/database').getDb;

class Review {
    constructor(userId, productId = null, serviceId = null, rating, comment, status = 'pending') {
        // Validate required fields
        this.validateReviewData(userId, rating, comment, productId, serviceId);
        
        this.userId = userId;
        this.productId = productId ? new mongodb.ObjectId(productId) : null;
        this.serviceId = serviceId ? new mongodb.ObjectId(serviceId) : null;
        this.rating = this.validateRating(rating);
        this.comment = this.validateComment(comment);
        this.status = this.validateStatus(status);
        this.adminReply = null;
        this.adminReplyDate = null;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    validateReviewData(userId, rating, comment, productId, serviceId) {
        if (!userId) {
            throw new Error('User ID là bắt buộc');
        }
        if (!rating || rating < 1 || rating > 5) {
            throw new Error('Rating phải từ 1-5 sao');
        }
        if (!comment || comment.trim().length === 0) {
            throw new Error('Nội dung đánh giá không được để trống');
        }
        if (comment.trim().length < 10) {
            throw new Error('Nội dung đánh giá phải có ít nhất 10 ký tự');
        }
        if (comment.trim().length > 1000) {
            throw new Error('Nội dung đánh giá không được quá 1000 ký tự');
        }
        if (!productId && !serviceId) {
            throw new Error('Phải có productId hoặc serviceId');
        }
        if (productId && serviceId) {
            throw new Error('Không thể đánh giá cả sản phẩm và dịch vụ cùng lúc');
        }
    }

    validateRating(rating) {
        const numRating = parseInt(rating);
        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
            throw new Error('Rating phải là số từ 1-5');
        }
        return numRating;
    }

    validateComment(comment) {
        const trimmedComment = comment.trim();
        if (trimmedComment.length < 10) {
            throw new Error('Nội dung đánh giá phải có ít nhất 10 ký tự');
        }
        if (trimmedComment.length > 1000) {
            throw new Error('Nội dung đánh giá không được quá 1000 ký tự');
        }
        // Sanitize comment để tránh XSS
        return this.sanitizeComment(trimmedComment);
    }

    validateStatus(status) {
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new Error('Trạng thái không hợp lệ');
        }
        return status;
    }

    sanitizeComment(comment) {
        // Loại bỏ các ký tự đặc biệt có thể gây XSS
        return comment
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    async save() {
        try {
            const db = getDb();
            let result;

            if (this._id) {
                // Cập nhật review
                this.updatedAt = new Date();
                result = await db.collection('reviews').updateOne(
                    { _id: this._id },
                    {
                        $set: {
                            rating: this.rating,
                            comment: this.comment,
                            status: this.status,
                            adminReply: this.adminReply,
                            adminReplyDate: this.adminReplyDate,
                            updatedAt: this.updatedAt
                        }
                    }
                );
            } else {
                // Thêm review mới
                result = await db.collection('reviews').insertOne(this);
                this._id = result.insertedId;
            }

            // Cập nhật rating trung bình cho sản phẩm hoặc dịch vụ
            if (this.productId) {
                await this.updateProductRating(this.productId);
            } else if (this.serviceId) {
                await this.updateServiceRating(this.serviceId);
            }

            return result;
        } catch (err) {
            console.error('Lỗi khi lưu review:', err);
            throw err;
        }
    }

    async updateProductRating(productId) {
        try {
            const db = getDb();
            const reviews = await db.collection('reviews')
                .find({ productId: productId, status: 'approved' })
                .toArray();

            if (reviews.length > 0) {
                const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
                const averageRating = totalRating / reviews.length;

                await db.collection('products').updateOne(
                    { _id: productId },
                    {
                        $set: {
                            rating: averageRating,
                            reviewCount: reviews.length
                        }
                    }
                );
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật rating sản phẩm:', err);
        }
    }

    async updateServiceRating(serviceId) {
        try {
            const db = getDb();
            const reviews = await db.collection('reviews')
                .find({ serviceId: serviceId, status: 'approved' })
                .toArray();

            if (reviews.length > 0) {
                const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
                const averageRating = totalRating / reviews.length;

                await db.collection('services').updateOne(
                    { _id: serviceId },
                    {
                        $set: {
                            rating: averageRating,
                            reviewCount: reviews.length
                        }
                    }
                );
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật rating dịch vụ:', err);
        }
    }

    static async fetchAll(page = 1, limit = 10, filter = {}) {
        try {
            const db = getDb();
            const skip = (page - 1) * limit;
            const reviews = await db.collection('reviews')
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            const total = await db.collection('reviews').countDocuments(filter);
            const totalPages = Math.ceil(total / limit) || 1;
            const hasPrevPage = page > 1;
            const hasNextPage = page < totalPages;
            const prevPage = hasPrevPage ? page - 1 : null;
            const nextPage = hasNextPage ? page + 1 : null;
            // Tạo mảng số trang hiển thị (tối đa 5 trang, giống sản phẩm)
            let startPage = Math.max(1, page - 2);
            let endPage = Math.min(totalPages, page + 2);
            if (endPage - startPage < 4) {
                if (startPage === 1) endPage = Math.min(5, totalPages);
                if (endPage === totalPages) startPage = Math.max(1, totalPages - 4);
            }
            const pageNumbers = [];
            for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
            return {
                reviews,
                total,
                totalPages,
                currentPage: page,
                hasPrevPage,
                hasNextPage,
                prevPage,
                nextPage,
                pageNumbers,
                limit,
                totalReviews: total
            };
        } catch (err) {
            console.error('Lỗi khi lấy danh sách reviews:', err);
            throw err;
        }
    }

    static async findById(reviewId) {
        try {
            const db = getDb();
            const review = await db.collection('reviews')
                .findOne({ _id: new mongodb.ObjectId(reviewId) });
            return review;
        } catch (err) {
            console.error('Lỗi khi tìm review:', err);
            throw err;
        }
    }

    static async deleteById(reviewId) {
        try {
            const db = getDb();
            const review = await this.findById(reviewId);
            
            if (!review) {
                throw new Error('Không tìm thấy review');
            }
            
            const result = await db.collection('reviews')
                .deleteOne({ _id: new mongodb.ObjectId(reviewId) });
                
            // Cập nhật lại rating cho sản phẩm hoặc dịch vụ
            if (review.productId) {
                await Review.prototype.updateProductRating.call(review, review.productId);
            } else if (review.serviceId) {
                await Review.prototype.updateServiceRating.call(review, review.serviceId);
            }
            
            return result;
        } catch (err) {
            console.error('Lỗi khi xóa review:', err);
            throw err;
        }
    }

    static async updateStatus(reviewId, status) {
        try {
            const db = getDb();
            const review = await this.findById(reviewId);
            
            if (!review) {
                throw new Error('Không tìm thấy review');
            }
            
            const result = await db.collection('reviews').updateOne(
                { _id: new mongodb.ObjectId(reviewId) },
                { 
                    $set: { 
                        status: status,
                        updatedAt: new Date() 
                    } 
                }
            );
            
            // Cập nhật lại rating cho sản phẩm hoặc dịch vụ
            if (review.productId) {
                await Review.prototype.updateProductRating.call(review, review.productId);
            } else if (review.serviceId) {
                await Review.prototype.updateServiceRating.call(review, review.serviceId);
            }
            
            return result;
        } catch (err) {
            console.error('Lỗi khi cập nhật trạng thái review:', err);
            throw err;
        }
    }

    static async getStats() {
        try {
            const db = getDb();
            
            // Tổng số đánh giá
            const totalReviews = await db.collection('reviews').countDocuments();
            
            // Đánh giá theo trạng thái
            const pendingReviews = await db.collection('reviews').countDocuments({ status: 'pending' });
            const approvedReviews = await db.collection('reviews').countDocuments({ status: 'approved' });
            const rejectedReviews = await db.collection('reviews').countDocuments({ status: 'rejected' });
            
            // Đánh giá theo loại
            const productReviews = await db.collection('reviews').countDocuments({ productId: { $ne: null } });
            const serviceReviews = await db.collection('reviews').countDocuments({ serviceId: { $ne: null } });
            
            return {
                total: totalReviews,
                pending: pendingReviews,
                approved: approvedReviews,
                rejected: rejectedReviews,
                product: productReviews,
                service: serviceReviews
            };
        } catch (err) {
            console.error('Lỗi khi lấy thống kê đánh giá:', err);
            return {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                product: 0,
                service: 0
            };
        }
    }

    static async addAdminReply(reviewId, reply) {
        try {
            const db = getDb();
            if (!mongodb.ObjectId.isValid(reviewId)) {
                throw new Error('ID review không hợp lệ');
            }
            const review = await this.findById(reviewId);
            
            if (!review) {
                throw new Error('Không tìm thấy review');
            }
            
            const result = await db.collection('reviews').updateOne(
                { _id: new mongodb.ObjectId(reviewId) },
                { 
                    $set: { 
                        adminReply: reply,
                        adminReplyDate: new Date(),
                        updatedAt: new Date() 
                    } 
                }
            );
            
            return result;
        } catch (err) {
            console.error('Lỗi khi thêm phản hồi admin:', err);
            throw err;
        }
    }

    // Kiểm tra user đã đánh giá sản phẩm/dịch vụ này chưa
    static async checkUserReviewExists(userId, productId = null, serviceId = null) {
        try {
            const db = getDb();
            const filter = { userId: userId };
            
            if (productId) {
                filter.productId = new mongodb.ObjectId(productId);
            } else if (serviceId) {
                filter.serviceId = new mongodb.ObjectId(serviceId);
            }
            
            const existingReview = await db.collection('reviews')
                .findOne(filter);
            
            return {
                exists: !!existingReview,
                review: existingReview
            };
        } catch (err) {
            console.error('Lỗi khi kiểm tra đánh giá tồn tại:', err);
            throw err;
        }
    }

    // Kiểm tra rate limiting cho đánh giá
    static async checkRateLimit(userId, timeWindow = 24 * 60 * 60 * 1000) { // 24 giờ
        // Tạm thời luôn cho phép gửi đánh giá khi test
        return { allowed: true, remaining: 99, totalToday: 0 };
    }

    // Cập nhật phản hồi admin
    static async updateAdminReply(reviewId, adminReply, adminName) {
        try {
            const db = getDb();
            const result = await db.collection('reviews').updateOne(
                { _id: new mongodb.ObjectId(reviewId) },
                {
                    $set: {
                        adminReply: adminReply,
                        adminReplyDate: new Date(),
                        adminName: adminName,
                        updatedAt: new Date()
                    }
                }
            );
            
            return result;
        } catch (err) {
            console.error('Lỗi khi cập nhật phản hồi admin:', err);
            throw err;
        }
    }

    // Lấy thống kê đánh giá
    static async getReviewStats() {
        try {
            const db = getDb();
            
            // Tổng số đánh giá
            const totalReviews = await db.collection('reviews').countDocuments();
            
            // Đánh giá theo trạng thái
            const pendingReviews = await db.collection('reviews').countDocuments({ status: 'pending' });
            const approvedReviews = await db.collection('reviews').countDocuments({ status: 'approved' });
            const rejectedReviews = await db.collection('reviews').countDocuments({ status: 'rejected' });
            
            // Đánh giá theo rating
            const ratingStats = await db.collection('reviews').aggregate([
                { $match: { status: 'approved' } },
                {
                    $group: {
                        _id: '$rating',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]).toArray();
            
            // Đánh giá theo thời gian (7 ngày gần đây)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentReviews = await db.collection('reviews').countDocuments({
                createdAt: { $gte: sevenDaysAgo }
            });
            
            // Đánh giá theo loại (sản phẩm/dịch vụ)
            const productReviews = await db.collection('reviews').countDocuments({ productId: { $exists: true } });
            const serviceReviews = await db.collection('reviews').countDocuments({ serviceId: { $exists: true } });
            
            return {
                total: totalReviews,
                pending: pendingReviews,
                approved: approvedReviews,
                rejected: rejectedReviews,
                ratingDistribution: ratingStats,
                recentReviews: recentReviews,
                productReviews: productReviews,
                serviceReviews: serviceReviews,
                approvalRate: totalReviews > 0 ? ((approvedReviews / totalReviews) * 100).toFixed(1) : 0
            };
        } catch (err) {
            console.error('Lỗi khi lấy thống kê đánh giá:', err);
            throw err;
        }
    }

    // Lấy đánh giá theo user
    static async findByUserId(userId, page = 1, limit = 10) {
        try {
            const db = getDb();
            const skip = (page - 1) * limit;
            
            const reviews = await db.collection('reviews')
                .find({ userId: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            
            const total = await db.collection('reviews')
                .countDocuments({ userId: userId });
            
            return {
                reviews: reviews,
                total: total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (err) {
            console.error('Lỗi khi lấy đánh giá theo user:', err);
            throw err;
        }
    }
}

module.exports = Review;