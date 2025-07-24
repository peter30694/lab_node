const Service = require('../../models/service');
const Booking = require('../../models/booking');
const mongodb = require('mongodb');

exports.getServices = async (req, res, next) => {
    try {
        const tab = req.query.tab || 'services';
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';
        const sort = req.query.sort || '';
        const validCategories = ['Chăm sóc', 'Huấn luyện', 'Sức khỏe', 'Trông giữ', 'Tư vấn', 'Vận chuyển'];
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 10;
        const { services, total, totalPages, currentPage, hasPrevPage, hasNextPage, prevPage, nextPage, pageNumbers, totalServices } = await Service.fetchAll(limit, page, category, status, sort, search);
        const bookingsRaw = await Booking.fetchAll(20, 0);
        // Lấy danh sách serviceId duy nhất
        const serviceIds = bookingsRaw.map(b => b.serviceId).filter(Boolean);
        const uniqueServiceIds = [...new Set(serviceIds.map(id => id.toString()))];
        let serviceMap = {};
        if (uniqueServiceIds.length > 0) {
            const db = require('../../util/database').getDb();
            const services = await db.collection('services').find({ _id: { $in: uniqueServiceIds.map(id => new mongodb.ObjectId(id)) } }).toArray();
            services.forEach(s => { serviceMap[s._id.toString()] = s; });
        }
        // Gán tên dịch vụ vào từng booking, log để debug
        const bookings = bookingsRaw.map(b => {
            let serviceKey = b.serviceId;
            if (serviceKey && typeof serviceKey === 'object' && serviceKey.toString) {
                serviceKey = serviceKey.toString();
            }
            const service = serviceKey && serviceMap[serviceKey] ? serviceMap[serviceKey] : null;
            if (!service) {
                console.log('Không tìm thấy dịch vụ cho booking:', b._id, 'serviceId:', b.serviceId);
            }
            return { ...b, service };
        });
        res.render('admin/services', {
            pageTitle: 'Quản lý dịch vụ',
            path: '/admin/services',
            services: services,
            categories: validCategories,
            category: category,
            status: status,
            sort: sort,
            tab: tab,
            search: search,
            totalPages,
            currentPage,
            total,
            totalServices,
            bookings,
            hasPrevPage,
            hasNextPage,
            prevPage,
            nextPage,
            pageNumbers,
            limit
        });
    } catch (err) {
        next(err);
    }
};

exports.getAddService = (req, res, next) => {
    res.render('admin/add-service', {
        pageTitle: 'Thêm dịch vụ',
        path: '/admin/services/add',
        editing: false
    });
};

exports.postAddService = async (req, res, next) => {
    try {
        console.log('req.body:', req.body);
        const {
            name = '',
            description = '',
            fullDescription = '',
            price = '0',
            duration = '0',
            category = 'general',
            status = 'active'
        } = req.body;
        let imageUrl = '';
        if (req.file && req.file.filename) {
            imageUrl = '/images/services/' + req.file.filename;
        }
        // Log kiểm tra dữ liệu đầu vào
        console.log('Thêm dịch vụ mới:', { name, description, fullDescription, price, duration, category, status, imageUrl });
        if (!name || !description || !fullDescription || !price || !duration || !category || !status) {
            console.warn('⚠️ Thiếu trường thông tin khi thêm dịch vụ!');
        }
        const newService = new Service(
            String(name || ''),
            String(description || ''),
            String(fullDescription || ''),
            isNaN(Number(price)) ? 0 : parseFloat(price),
            isNaN(Number(duration)) ? 0 : parseInt(duration),
            String(imageUrl),
            String(category || 'general'),
            String(status || 'active')
        );
        await newService.save();
        res.redirect('/admin/services');
    } catch (err) {
        next(err);
    }
};

exports.getEditService = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.serviceId);
        if (!service) {
            return res.redirect('/admin/services');
        }
        res.render('admin/edit-service', {
            pageTitle: 'Chỉnh sửa dịch vụ',
            path: '/admin/services',
            editing: true,
            service: service
        });
    } catch (err) {
        next(err);
    }
};

exports.postEditService = async (req, res, next) => {
    try {
        const { serviceId, name, description, fullDescription, price, duration, category, status, currentImage } = req.body;
        let imageUrl = currentImage || '';
        if (req.file && req.file.filename) {
            imageUrl = '/images/services/' + req.file.filename;
        }
        const updatedService = {
            name: String(name),
            description: String(description),
            fullDescription: String(fullDescription),
            price: parseFloat(price),
            duration: parseInt(duration),
            imageUrl,
            category: String(category),
            status: String(status)
        };
        console.log('serviceId:', serviceId);
        console.log('Dữ liệu cập nhật:', updatedService);
        await Service.updateById(serviceId, updatedService);
        res.redirect('/admin/services');
    } catch (err) {
        next(err);
    }
};

exports.deleteService = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        if (!mongodb.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ message: 'ID không hợp lệ' });
        }
        await Service.deleteById(serviceId);
        res.status(200).json({ message: 'Success!' });
    } catch (err) {
        console.error('Lỗi khi xóa dịch vụ:', err);
        res.status(500).json({ message: 'Deleting service failed.', error: err.message });
    }
}; 