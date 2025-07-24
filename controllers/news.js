const { validationResult } = require('express-validator');
const News = require('../models/news');

// GET /news - Danh sách tin tức (public)
exports.getNewsList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const category = req.query.category || null;
        
        const { news, total, totalPages } = await News.fetchAll(limit, page, category, 'published');
        
        res.render('news/index', {
            pageTitle: 'Tin tức',
            path: '/news',
            news: news,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            category: category,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            isAuthenticated: Boolean(res.locals.isAuthenticated),
            isAdmin: Boolean(res.locals.isAdmin),
            user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null,
            cartCount: req.cart ? Math.max(0, req.cart.getItemCount() || 0) : 0,
            categories: Array.isArray(res.locals.categories) ? res.locals.categories : [],
            favorites: Array.isArray(res.locals.favorites) ? res.locals.favorites : []
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách tin tức:', err);
        next(err);
    }
};

// GET /news/:id - Chi tiết tin tức (public)
exports.getNewsDetail = async (req, res, next) => {
    try {
        const newsId = req.params.id;
        let news = await News.findByIdCustom(newsId);
        
        // Nếu không tìm thấy theo ID, thử tìm theo slug
        if (!news) {
            news = await News.findBySlug(newsId);
        }
        
        // Kiểm tra quyền truy cập
        const isAdmin = Boolean(res.locals.isAdmin);
        const isAuthenticated = Boolean(res.locals.isAuthenticated);
        
        // Nếu không phải admin và tin tức không published, trả về 404
        if (!news || (!isAdmin && news.status !== 'published')) {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy tin tức',
                path: '/news',
                message: 'Tin tức bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.',
                url: typeof req.originalUrl === 'string' ? req.originalUrl : '',
                isAdmin: isAdmin,
                isAuthenticated: isAuthenticated,
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null,
                cartCount: req.cart ? Math.max(0, req.cart.getItemCount() || 0) : 0,
                categories: Array.isArray(res.locals.categories) ? res.locals.categories : [],
                favorites: Array.isArray(res.locals.favorites) ? res.locals.favorites : []
            });
        }
        
        // Chỉ tăng lượt xem nếu là public hoặc admin xem published content
        if (news.status === 'published') {
            await news.incrementViews();
        }
        
        // Lấy tin tức liên quan (chỉ published cho public)
        const { news: relatedNews } = await News.fetchAll(4, 1, news.category, isAdmin ? null : 'published');
        const filteredRelatedNews = relatedNews.filter(item => item._id.toString() !== news._id.toString());
        
        res.render('news/detail', {
            pageTitle: news.title,
            path: '/news',
            news: news,
            relatedNews: filteredRelatedNews.slice(0, 3),
            isAuthenticated: isAuthenticated,
            isAdmin: isAdmin,
            user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null,
            cartCount: req.cart ? Math.max(0, req.cart.getItemCount() || 0) : 0,
            categories: Array.isArray(res.locals.categories) ? res.locals.categories : [],
            favorites: Array.isArray(res.locals.favorites) ? res.locals.favorites : []
        });
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết tin tức:', err);
        next(err);
    }
};

// ========== ADMIN CONTROLLERS ==========

// GET /admin/news - Danh sách tin tức (admin)
exports.getAdminNews = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const status = req.query.status || 'all';
        
        const { news, total, totalPages } = await News.fetchAll(limit, page, null, status === 'all' ? null : status);
        
        res.render('admin/news', {
            pageTitle: 'Quản lý tin tức',
            path: '/admin/news',
            news: news,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            status: status,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            isAuthenticated: Boolean(res.locals.isAuthenticated),
            isAdmin: Boolean(res.locals.isAdmin),
            user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách tin tức admin:', err);
        next(err);
    }
};

// GET /admin/news/detail/:id - Xem chi tiết tin tức (admin)
exports.getAdminNewsDetail = async (req, res, next) => {
    try {
        const newsId = req.params.newsId;
        const news = await News.findById(newsId);
        
        if (!news) {
            req.flash('error', 'Không tìm thấy tin tức!');
            return res.redirect('/admin/news');
        }
        
        res.render('admin/news-detail', {
            pageTitle: `Chi tiết tin tức - ${news.title}`,
            path: '/admin/news',
            news: news,
            isAuthenticated: Boolean(res.locals.isAuthenticated),
            isAdmin: Boolean(res.locals.isAdmin),
            user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
        });
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết tin tức admin:', err);
        next(err);
    }
};

// GET /admin/news/add - Thêm tin tức mới (admin)
exports.getAddNews = (req, res, next) => {
    res.render('admin/add-news', {
        pageTitle: 'Thêm tin tức',
        path: '/admin/news',
        editing: false,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
        news: {
            title: '',
            content: '',
            imageUrl: '',
            category: 'Tin tức',
            author: 'Pet Store',
            status: 'published'
        },
        isAuthenticated: Boolean(res.locals.isAuthenticated),
        isAdmin: Boolean(res.locals.isAdmin),
        user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
    });
};

// POST /admin/news/add - Xử lý thêm tin tức (admin)
exports.postAddNews = async (req, res, next) => {
    try {
        console.log('=== POST /admin/news/add START ===');
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        console.log('req.headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        
        const { title, content, category, author, status } = req.body;
        const errors = validationResult(req);
        
        console.log('Validation errors:', errors.array());
        
        if (!errors.isEmpty()) {
            console.log('Validation failed, rendering error page');
            return res.status(422).render('admin/add-news', {
                pageTitle: 'Thêm tin tức',
                path: '/admin/news',
                editing: false,
                hasError: true,
                news: { title, content, imageUrl: '', category, author, status },
                errorMessage: errors.array()[0].msg,
                validationErrors: errors.array(),
                isAuthenticated: Boolean(res.locals.isAuthenticated),
                isAdmin: Boolean(res.locals.isAdmin),
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
            });
        }

        if (!req.file) {
            console.log('No file uploaded, rendering error page');
            return res.status(422).render('admin/add-news', {
                pageTitle: 'Thêm tin tức',
                path: '/admin/news',
                editing: false,
                hasError: true,
                news: { title, content, imageUrl: '', category, author, status },
                errorMessage: 'Vui lòng tải lên hình ảnh tin tức',
                validationErrors: [],
                isAuthenticated: Boolean(res.locals.isAuthenticated),
                isAdmin: Boolean(res.locals.isAdmin),
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
            });
        }

        console.log('File uploaded successfully:', req.file);

        // ===== SANITIZE CONTENT =====
        const sanitizedContent = this.sanitizeContent(content);

        // ===== TẠO TIN TỨC MỚI =====
        const imageUrl = '/images/news/' + req.file.filename;
        console.log('Image URL:', imageUrl);
        
        const news = new News({
            title: title.trim(),
            content: sanitizedContent,
            imageUrl,
            category: category || 'Tin tức',
            author: author || 'Pet Store',
            status: status || 'published'
        });
        
        await news.save();
        
        console.log(`📰 Admin ${req.session.user.email} đã tạo tin tức: ${title}`);
        console.log('=== POST /admin/news/add SUCCESS ===');
        
        req.flash('success', 'Thêm tin tức thành công!');
        res.redirect('/admin/news');
    } catch (err) {
        console.error('=== POST /admin/news/add ERROR ===');
        console.error('Lỗi khi thêm tin tức:', err);
        next(err);
    }
};

// GET /admin/news/edit/:id - Chỉnh sửa tin tức (admin)
exports.getEditNews = async (req, res, next) => {
    try {
        const newsId = req.params.newsId;
        console.log('🔍 DEBUG: Looking for news with ID:', newsId);
        
        const news = await News.findById(newsId);
        
        if (!news) {
            console.log('🔍 DEBUG: News not found with ID:', newsId);
            req.flash('error', 'Không tìm thấy tin tức!');
            return res.redirect('/admin/news');
        }
        
        console.log('🔍 DEBUG: Found news:', news.title);
        
        res.render('admin/add-news', {
            pageTitle: 'Chỉnh sửa tin tức',
            path: '/admin/news',
            editing: true,
            news: news,
            hasError: false,
            errorMessage: null,
            validationErrors: [],
            isAuthenticated: Boolean(res.locals.isAuthenticated),
            isAdmin: Boolean(res.locals.isAdmin),
            user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
        });
    } catch (err) {
        console.error('Lỗi khi lấy tin tức để chỉnh sửa:', err);
        next(err);
    }
};

// POST /admin/news/edit - Xử lý chỉnh sửa tin tức (admin)
exports.postEditNews = async (req, res, next) => {
    try {
        const { newsId, title, content, category, author, status } = req.body;
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(422).render('admin/add-news', {
                pageTitle: 'Chỉnh sửa tin tức',
                path: '/admin/news',
                editing: true,
                hasError: true,
                news: { _id: newsId, title, content, imageUrl: '', category, author, status },
                errorMessage: errors.array()[0].msg,
                validationErrors: errors.array(),
                isAuthenticated: Boolean(res.locals.isAuthenticated),
                isAdmin: Boolean(res.locals.isAdmin),
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
            });
        }

        // ===== VALIDATION BỔ SUNG =====
        if (!title || title.trim().length < 5) {
            return res.status(422).render('admin/add-news', {
                pageTitle: 'Chỉnh sửa tin tức',
                path: '/admin/news',
                editing: true,
                hasError: true,
                news: { _id: newsId, title, content, imageUrl: '', category, author, status },
                errorMessage: 'Tiêu đề phải có ít nhất 5 ký tự',
                validationErrors: [],
                isAuthenticated: Boolean(res.locals.isAuthenticated),
                isAdmin: Boolean(res.locals.isAdmin),
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
            });
        }

        if (!content || content.trim().length < 10) {
            return res.status(422).render('admin/add-news', {
                pageTitle: 'Chỉnh sửa tin tức',
                path: '/admin/news',
                editing: true,
                hasError: true,
                news: { _id: newsId, title, content, imageUrl: '', category, author, status },
                errorMessage: 'Nội dung phải có ít nhất 10 ký tự',
                validationErrors: [],
                isAuthenticated: Boolean(res.locals.isAuthenticated),
                isAdmin: Boolean(res.locals.isAdmin),
                user: res.locals.user && typeof res.locals.user === 'object' ? res.locals.user : null
            });
        }

        // ===== TÌM TIN TỨC =====
        const news = await News.findById(newsId);
        if (!news) {
            req.flash('error', 'Không tìm thấy tin tức!');
            return res.redirect('/admin/news');
        }

        // ===== SANITIZE CONTENT =====
        const sanitizedContent = this.sanitizeContent(content);
        
        // ===== CẬP NHẬT TIN TỨC =====
        news.title = title.trim();
        news.content = sanitizedContent;
        if (req.file) {
            news.imageUrl = '/images/news/' + req.file.filename;
        }
        news.category = category || 'Tin tức';
        news.author = author || 'Pet Store';
        news.status = status || 'published';
        
        await news.save();
        
        console.log(`📰 Admin ${req.session.user.email} đã cập nhật tin tức: ${title}`);
        
        req.flash('success', 'Cập nhật tin tức thành công!');
        res.redirect('/admin/news');
    } catch (err) {
        console.error('Lỗi khi cập nhật tin tức:', err);
        next(err);
    }
};

// POST /admin/news/delete - Xóa tin tức (admin)
exports.postDeleteNews = async (req, res, next) => {
    try {
        const newsId = req.body.newsId;
        const news = await News.findById(newsId);
        
        if (!news) {
            req.flash('error', 'Không tìm thấy tin tức!');
            return res.redirect('/admin/news');
        }
        
        await News.deleteById(newsId);
        
        req.flash('success', 'Xóa tin tức thành công!');
        res.redirect('/admin/news');
    } catch (err) {
        console.error('Lỗi khi xóa tin tức:', err);
        next(err);
    }
};

// Helper method để sanitize content
exports.sanitizeContent = (content) => {
    // Loại bỏ các script tags và các ký tự nguy hiểm
    let sanitized = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    
    // Cho phép một số HTML tags an toàn
    const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'];
    const allowedAttributes = ['class', 'id', 'style'];
    
    // Tạo regex để match các tags không được phép
    const tagRegex = /<(\/?)([^>]+)>/g;
    sanitized = sanitized.replace(tagRegex, (match, slash, tagName) => {
        const tag = tagName.split(' ')[0].toLowerCase();
        if (allowedTags.includes(tag)) {
            return match; // Giữ nguyên tag được phép
        }
        return ''; // Loại bỏ tag không được phép
    });
    
    return sanitized;
};