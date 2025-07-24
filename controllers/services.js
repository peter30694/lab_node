const Service = require('../models/service');
const { validationResult } = require('express-validator');
const Booking = require('../models/booking');

// GET /services - Danh sách dịch vụ
exports.getServices = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // Tăng số lượng hiển thị
        const category = req.query.category || '';
        const sort = req.query.sort || '';
        
        // Build filter object
        let filter = { status: 'active' }; // Chỉ hiển thị dịch vụ hoạt động
        if (category && category !== 'all') {
            filter.category = category;
        }

        // Build sort object
        let sortObject = { createdAt: -1 };
        if (sort) {
            switch (sort) {
                case 'name_asc':
                    sortObject = { name: 1 };
                    break;
                case 'name_desc':
                    sortObject = { name: -1 };
                    break;
                case 'price_asc':
                    sortObject = { price: 1 };
                    break;
                case 'price_desc':
                    sortObject = { price: -1 };
                    break;
                case 'rating_desc':
                    sortObject = { rating: -1 };
                    break;
                case 'bookings_desc':
                    sortObject = { bookings: -1 };
                    break;
                default:
                    sortObject = { createdAt: -1 };
            }
        }

        // Get services with filtering and sorting using Service model
        const { services, total, totalPages } = await Service.fetchAll(limit, page, category, 'active', sort);
        
        // Get service categories for filter - only get actual category names, not file paths
        const db = require('../util/database').getDb();
        const allServices = await db.collection('services').find({ status: 'active' }).toArray();
        
        // Chỉ lấy các category hợp lệ (danh sách trắng)
        const validCategories = ['Chăm sóc', 'Huấn luyện', 'Sức khỏe', 'Trông giữ', 'Tư vấn', 'Vận chuyển'];
        const serviceCategories = [...new Set(allServices.map(service => service.category))]
            .filter(cat => validCategories.includes(cat));
        // Không khai báo lại finalCategories, chỉ dùng biến này
        const categoriesToRender = serviceCategories.length > 0 ? serviceCategories : validCategories;
        
        console.log('Service categories found:', serviceCategories);
        
        // Fallback categories if none found in database
        const fallbackCategories = ['Chăm sóc', 'Huấn luyện', 'Sức khỏe', 'Trông giữ', 'Tư vấn', 'Vận chuyển'];
        
        res.render('services/index', {
            pageTitle: 'Dịch vụ Pet Store',
            path: '/services',
            services: services,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            category: category,
            sort: sort,
            serviceCategories: categoriesToRender, // Sử dụng biến mới
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách dịch vụ:', err);
        next(err);
    }
};

// GET /services/:id - Chi tiết dịch vụ
exports.getServiceDetail = async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const service = await Service.findById(serviceId);
        
        if (!service || service.status !== 'active') {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy dịch vụ',
                path: '/services',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            , message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.', url: req.originalUrl});
        }
        
        // Lấy dịch vụ liên quan
        const db = require('../util/database').getDb();
        const relatedServices = await db.collection('services')
            .find({ 
                category: service.category, 
                status: 'active',
                _id: { $ne: service._id }
            })
            .limit(3)
            .toArray();
        
        res.render('services/detail', {
            pageTitle: service.name,
            path: '/services',
            service: service,
            relatedServices: relatedServices,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết dịch vụ:', err);
        next(err);
    }
};

// GET /services/book/:id - Form đặt lịch dịch vụ
exports.getBookService = async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const service = await Service.findById(serviceId);
        
        if (!service || service.status !== 'active') {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy dịch vụ',
                path: '/services',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            , message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.', url: req.originalUrl});
        }
        
        res.render('services/book', {
            pageTitle: `Đặt lịch - ${service.name}`,
            path: '/services',
            service: service,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi lấy form đặt lịch:', err);
        next(err);
    }
};

// POST /services/book/:id - Xử lý đặt lịch dịch vụ
exports.postBookService = async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const { date, time, notes, petName, petType } = req.body;
        
        if (!req.session.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Vui lòng đăng nhập để đặt lịch' 
            });
        }
        
        // Validate dữ liệu đầu vào
        if (!date || !time || !petName || !petType) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }
        
        const service = await Service.findById(serviceId);
        if (!service || service.status !== 'active') {
            return res.status(404).json({ 
                success: false, 
                message: 'Dịch vụ không tồn tại hoặc không khả dụng' 
            });
        }
        
        // Tạo timeSlot từ thời gian được chọn
        const timeSlot = {
            start: time,
            end: getEndTime(time) // Helper function để tính thời gian kết thúc
        };
        
        // Validate thời gian đặt lịch
        const timeValidation = Booking.validateBookingTime(date, timeSlot);
        if (!timeValidation.valid) {
            return res.status(400).json({
                success: false,
                message: timeValidation.message
            });
        }
        
        // Kiểm tra trùng lịch đặt
        const conflictCheck = await Booking.checkBookingConflict(serviceId, date, timeSlot);
        if (conflictCheck.hasConflict) {
            return res.status(409).json({
                success: false,
                message: conflictCheck.message
            });
        }
        
        // Tạo booking mới
        const booking = new Booking(
            req.session.user._id,
            serviceId,
            {
                name: req.session.user.name,
                phone: req.session.user.phone || '',
                email: req.session.user.email,
                petInfo: { name: petName, type: petType }
            },
            date,
            timeSlot,
            notes
        );
        
        await booking.save();
        
        // Cập nhật số lượt đặt của dịch vụ
        const db = require('../util/database').getDb();
        await db.collection('services').updateOne(
            { _id: service._id },
            { $inc: { bookings: 1 } }
        );
        
        // Gửi email xác nhận đặt lịch
        try {
            const { sendEmail } = require('../util/email');
            await sendEmail({
                to: req.session.user.email,
                subject: 'Xác nhận đặt lịch dịch vụ',
                template: 'booking-confirmation',
                data: {
                    userName: req.session.user.name,
                    serviceName: service.name,
                    bookingDate: date,
                    bookingTime: time,
                    petName: petName,
                    petType: petType,
                    notes: notes || 'Không có'
                }
            });
        } catch (emailErr) {
            console.error('Lỗi khi gửi email xác nhận:', emailErr);
            // Không trả về lỗi cho user, chỉ log
        }
        
        res.json({ 
            success: true, 
            message: 'Đặt lịch thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.',
            bookingId: booking._id
        });
        
    } catch (err) {
        console.error('Lỗi khi đặt lịch:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.' 
        });
    }
};

// Helper function để tính thời gian kết thúc
function getEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 1;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// GET /services/:id/available-slots - Lấy slot thời gian khả dụng
exports.getAvailableTimeSlots = async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Ngày là bắt buộc'
            });
        }
        
        const service = await Service.findById(serviceId);
        if (!service || service.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Dịch vụ không tồn tại hoặc không khả dụng'
            });
        }
        
        const availableSlots = await Booking.getAvailableTimeSlots(serviceId, date);
        
        res.json({
            success: true,
            availableSlots: availableSlots,
            selectedDate: date
        });
        
    } catch (err) {
        console.error('Lỗi khi lấy slot thời gian khả dụng:', err);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi lấy slot thời gian'
        });
    }
};

// GET /services/category/:category - Dịch vụ theo danh mục
exports.getServicesByCategory = async (req, res, next) => {
    try {
        const category = req.params.category;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        
        const { services, total, totalPages } = await Service.fetchAll(limit, page, category, 'active');
        
        res.render('services/category', {
            pageTitle: `Dịch vụ ${category}`,
            path: '/services',
            services: services,
            category: category,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi lấy dịch vụ theo danh mục:', err);
        next(err);
    }
};

// Admin Controllers
exports.getAdminServices = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const status = req.query.status || 'all';
        
        const { services, total, totalPages } = await Service.fetchAll(limit, page, null, status === 'all' ? null : status);
        
        res.render('admin/services/services-list', {
            pageTitle: 'Quản lý dịch vụ',
            path: '/admin/services',
            services: services,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            status: status,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách dịch vụ admin:', err);
        next(err);
    }
};

exports.getAddService = (req, res, next) => {
    res.render('admin/services/add-service', {
        pageTitle: 'Thêm dịch vụ',
        path: '/admin/services',
        editing: false,
        hasError: false,
        errorMessage: null,
        validationErrors: []
    });
};

exports.postAddService = async (req, res, next) => {
    try {
        const { name, description, fullDescription, price, duration, imageUrl, category, status } = req.body;
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(422).render('admin/services/add-service', {
                pageTitle: 'Thêm dịch vụ',
                path: '/admin/services',
                editing: false,
                hasError: true,
                service: { name, description, fullDescription, price, duration, imageUrl, category, status },
                errorMessage: errors.array()[0].msg,
                validationErrors: errors.array()
            });
        }
        
        const service = new Service(name, description, fullDescription, price, duration, imageUrl, category, status);
        await service.save();
        
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Lỗi khi thêm dịch vụ:', err);
        next(err);
    }
};

exports.getEditService = async (req, res, next) => {
    try {
        const serviceId = req.params.serviceId;
        const service = await Service.findById(serviceId);
        
        if (!service) {
            return res.redirect('/admin/services');
        }
        
        res.render('admin/services/add-service', {
            pageTitle: 'Chỉnh sửa dịch vụ',
            path: '/admin/services',
            editing: true,
            service: service,
            hasError: false,
            errorMessage: null,
            validationErrors: []
        });
    } catch (err) {
        console.error('Lỗi khi lấy dịch vụ để chỉnh sửa:', err);
        next(err);
    }
};

exports.postEditService = async (req, res, next) => {
    try {
        const { serviceId, name, description, fullDescription, price, duration, imageUrl, category, status } = req.body;
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(422).render('admin/services/add-service', {
                pageTitle: 'Chỉnh sửa dịch vụ',
                path: '/admin/services',
                editing: true,
                hasError: true,
                service: { _id: serviceId, name, description, fullDescription, price, duration, imageUrl, category, status },
                errorMessage: errors.array()[0].msg,
                validationErrors: errors.array()
            });
        }
        
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.redirect('/admin/services');
        }
        
        service.name = name;
        service.description = description;
        service.fullDescription = fullDescription;
        service.price = parseFloat(price);
        service.duration = duration;
        service.imageUrl = imageUrl;
        service.category = category;
        service.status = status;
        service.updatedAt = new Date();
        
        await service.save();
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Lỗi khi cập nhật dịch vụ:', err);
        next(err);
    }
};

exports.postDeleteService = async (req, res, next) => {
    try {
        const serviceId = req.body.serviceId;
        await Service.deleteById(serviceId);
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Lỗi khi xóa dịch vụ:', err);
        next(err);
    }
};

const { sendEmail } = require('../util/email');

// GET /my-bookings - Lịch đặt của user
exports.getMyBookings = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        const bookings = await Booking.findByUserId(req.session.user._id);
        
        // Lấy thông tin dịch vụ cho mỗi booking
        const bookingsWithServices = await Promise.all(
            bookings.map(async (booking) => {
                const service = await Service.findById(booking.serviceId);
                return { ...booking, service };
            })
        );

        res.render('services/my-bookings', {
            pageTitle: 'Lịch đặt của tôi',
            path: '/my-bookings',
            bookings: bookingsWithServices
        });
    } catch (err) {
        console.error('Lỗi khi lấy lịch đặt của user:', err);
        next(err);
    }
};

// API kiểm tra trùng giờ đặt dịch vụ
exports.checkBookingConflict = async (req, res) => {
    try {
        const { serviceId, bookingDate, timeSlot } = req.body;
        if (!serviceId || !bookingDate || !timeSlot || !timeSlot.start || !timeSlot.end) {
            return res.status(400).json({ hasConflict: false, message: 'Thiếu thông tin kiểm tra.' });
        }
        const conflict = await Booking.checkBookingConflict(serviceId, bookingDate, timeSlot);
        res.json(conflict);
    } catch (err) {
        res.status(500).json({ hasConflict: false, message: 'Lỗi server khi kiểm tra trùng giờ.' });
    }
};