const Review = require('../../models/review');
const Product = require('../../models/product');
const Service = require('../../models/service');
const mongodb = require('mongodb');

function normalizeVN(str) {
    return str
        .normalize('NFD')
        .replace(/[\u00C0-\u00C3\u00C8-\u00CB\u00CC-\u00CF\u00D2-\u00D6\u00D9-\u00DC\u00E0-\u00E3\u00E8-\u00EB\u00EC-\u00EF\u00F2-\u00F6\u00F9-\u00FC\u0000-\u007F]/g, '')
        .replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '')
        .replace(/\u02C6|\u0306|\u031B/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase();
}

exports.getReviews = async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        let filter = {};
        if (search) {
            filter.$or = [
                { comment: { $regex: search, $options: 'i' } },
                { adminReply: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            filter.status = status;
        }
        const page = parseInt(req.query.page, 10) || 1;
        const { reviews, total, totalPages, currentPage, hasPrevPage, hasNextPage, prevPage, nextPage, pageNumbers, limit, totalReviews } = await Review.fetchAll(page, 5, filter);
        // Bổ sung lấy thông tin user, sản phẩm/dịch vụ cho từng review
        const User = require('../../models/user');
        const reviewsWithDetails = await Promise.all(reviews.map(async (review) => {
            let itemDetails = null;
            if (review.productId) {
                let prodId = review.productId;
                if (typeof prodId === 'string') {
                    try { prodId = new mongodb.ObjectId(prodId); } catch(e) {}
                }
                itemDetails = await Product.findById(prodId);
                if (itemDetails) itemDetails.type = 'product';
            } else if (review.serviceId) {
                let serviceId = review.serviceId;
                if (typeof serviceId === 'string') {
                    try { serviceId = new mongodb.ObjectId(serviceId); } catch(e) {}
                }
                itemDetails = await Service.findById(serviceId);
                if (itemDetails) itemDetails.type = 'service';
            }
            // Lấy thông tin user
            let user = null;
            if (review.userId) {
                user = await User.findById(review.userId);
            }
            return { ...review, itemDetails, user };
        }));
        let filteredReviews = reviewsWithDetails;
        if (search) {
            const searchLower = normalizeVN(search);
            filteredReviews = reviewsWithDetails.filter(review => {
                const fields = [
                    review.comment,
                    review.adminReply,
                    review.user?.name,
                    review.user?.email,
                    review.itemDetails?.title,
                    review.itemDetails?.name
                ];
                return fields.some(field =>
                    field && normalizeVN(field).includes(searchLower)
                );
            });
        }
        // Lấy thống kê tổng hợp
        const stats = await Review.getStats();
        res.render('admin/reviews', {
            pageTitle: 'Quản lý đánh giá',
            path: '/admin/reviews',
            reviews: filteredReviews,
            stats,
            search: search,
            status: status,
            pagination: {
                total,
                totalPages,
                currentPage,
                hasPrevPage,
                hasNextPage,
                prevPage,
                nextPage,
                pageNumbers,
                limit,
                totalReviews
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getReviewDetail = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.redirect('/admin/reviews');
        }
        // Lấy thông tin user
        let user = null;
        if (review.userId) {
            const User = require('../../models/user');
            user = await User.findById(review.userId);
        }
        // Lấy thông tin sản phẩm hoặc dịch vụ
        let product = null, service = null;
        if (review.productId) {
            product = await Product.findById(review.productId);
        } else if (review.serviceId) {
            service = await Service.findById(review.serviceId);
        }
        res.render('admin/review-detail', {
            pageTitle: 'Chi tiết đánh giá',
            path: '/admin/reviews',
            review: { ...review, user, product, service }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateReviewStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await Review.updateStatus(req.params.reviewId, status);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Updating review status failed.' });
    }
};

exports.replyToReview = async (req, res, next) => {
    try {
        const replyText = req.body.replyText || req.body.adminReply;
        await Review.addAdminReply(req.params.reviewId, replyText);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true });
        }
        res.redirect(`/admin/reviews/${req.params.reviewId}`);
    } catch (err) {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi gửi phản hồi' });
        }
        next(err);
    }
};

exports.deleteReview = async (req, res, next) => {
    try {
        await Review.deleteById(req.params.reviewId);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Deleting review failed.' });
    }
};

exports.getReviewStats = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};