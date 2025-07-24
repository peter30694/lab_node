const Order = require('../../models/order');
const User = require('../../models/user');
const Product = require('../../models/product');
const { generateOrderPDF } = require('../../util/pdf');
const { sendOrderConfirmation, sendOrderStatusUpdate, sendPaymentStatusUpdate } = require('../../util/email');
const { getDb } = require('../../util/database');
const mongoose = require('mongoose');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const emailService = require('../../util/email-service');

// Controller tải xuống hóa đơn
exports.getDownloadInvoice = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        console.log('Bắt đầu tải xuống hóa đơn cho đơn hàng:', orderId);

        // Kiểm tra tính hợp lệ của orderId
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            console.error('ID đơn hàng không hợp lệ:', orderId);
            return res.status(400).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'ID đơn hàng không hợp lệ'
            });
        }

        // Lấy thông tin đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            console.error('Không tìm thấy đơn hàng với ID:', orderId);
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy đơn hàng',
                path: '/error',
                message: 'Không tìm thấy đơn hàng với ID: ' + orderId
            });
        }

        // Lấy thông tin người dùng
        const user = await User.findById(order.userId);
        let defaultUser = null;
        if (!user) {
            console.error('Không tìm thấy người dùng với ID:', order.userId);
            // Tạo user object mặc định nếu không tìm thấy user
            defaultUser = {
                _id: order.userId,
                name: order.shippingInfo?.name || 'Khách hàng',
                email: order.shippingInfo?.email || 'customer@example.com',
                phone: order.shippingInfo?.phone || 'N/A'
            };
            console.log('Sử dụng thông tin user mặc định:', defaultUser);
        }

        // Tạo PDF
        console.log('Đang tạo PDF hóa đơn...');
        const userForPDF = user || defaultUser;
        const pdfPath = await generateOrderPDF(order, userForPDF);
        console.log('Đã tạo PDF hóa đơn thành công tại:', pdfPath);

        // Kiểm tra file PDF có tồn tại không
        if (!fs.existsSync(pdfPath)) {
            console.error('File PDF không tồn tại sau khi tạo:', pdfPath);
            return res.status(500).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Không thể tạo file PDF hóa đơn'
            });
        }

        // Gửi file PDF về client
        res.download(pdfPath, `invoice-${orderId}.pdf`, (err) => {
            if (err) {
                console.error('Lỗi khi tải file PDF:', err);
                return res.status(500).render('error/500', {
                    pageTitle: 'Lỗi',
                    path: '/error',
                    message: 'Không thể tải xuống file PDF: ' + err.message
                });
            }
            console.log('Đã gửi file PDF hóa đơn thành công');

            // Xóa file sau khi đã gửi
            fs.unlink(pdfPath, (err) => {
                if (err) {
                    console.error('Lỗi khi xóa file PDF:', err);
                } else {
                    console.log('Đã xóa file PDF hóa đơn tạm thời');
                }
            });
        });
    } catch (err) {
        console.error('Lỗi khi tải xuống hóa đơn:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải xuống hóa đơn: ' + err.message
        });
    }
};

// Controller tải xuống hóa đơn theo orderId (cho route /orders/:orderId/download-invoice)
exports.getDownloadInvoiceById = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        console.log('Bắt đầu tải xuống hóa đơn cho đơn hàng:', orderId);

        // Kiểm tra tính hợp lệ của orderId
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            console.error('ID đơn hàng không hợp lệ:', orderId);
            return res.status(400).json({ 
                success: false, 
                message: 'ID đơn hàng không hợp lệ' 
            });
        }

        // Lấy thông tin đơn hàng
        const order = await Order.findById(orderId);
        if (!order) {
            console.error('Không tìm thấy đơn hàng với ID:', orderId);
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy đơn hàng với ID: ' + orderId 
            });
        }

        // Lấy thông tin người dùng
        const user = await User.findById(order.userId);
        let defaultUser = null;
        if (!user) {
            console.error('Không tìm thấy người dùng với ID:', order.userId);
            // Tạo user object mặc định nếu không tìm thấy user
            defaultUser = {
                _id: order.userId,
                name: order.shippingInfo?.name || 'Khách hàng',
                email: order.shippingInfo?.email || 'customer@example.com',
                phone: order.shippingInfo?.phone || 'N/A'
            };
            console.log('Sử dụng thông tin user mặc định:', defaultUser);
        }

        // Tạo PDF
        console.log('Đang tạo PDF hóa đơn...');
        const userForPDF = user || defaultUser;
        const pdfPath = await generateOrderPDF(order, userForPDF);
        console.log('Đã tạo PDF hóa đơn thành công tại:', pdfPath);

        // Kiểm tra file PDF có tồn tại không
        if (!fs.existsSync(pdfPath)) {
            console.error('File PDF không tồn tại sau khi tạo:', pdfPath);
            return res.status(500).json({ 
                success: false, 
                message: 'Không thể tạo file PDF hóa đơn' 
            });
        }

        // Gửi file PDF về client
        const fileName = `invoice-${orderId}-${new Date().toISOString().slice(0, 10)}.pdf`;
        res.download(pdfPath, fileName, (err) => {
            if (err) {
                console.error('Lỗi khi tải file PDF:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Không thể tải xuống file PDF: ' + err.message 
                });
            }
            console.log('Đã gửi file PDF hóa đơn thành công');

            // Xóa file sau khi đã gửi
            fs.unlink(pdfPath, (err) => {
                if (err) {
                    console.error('Lỗi khi xóa file PDF:', err);
                } else {
                    console.log('Đã xóa file PDF hóa đơn tạm thời');
                }
            });
        });
    } catch (err) {
        console.error('Lỗi khi tải xuống hóa đơn:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Không thể tải xuống hóa đơn: ' + err.message 
        });
    }
};

// Quản lý đơn hàng
exports.getOrders = async (req, res, next) => {
    let filter = {};
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const payment = req.query.payment || '';
        const method = req.query.method || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        // Xây dựng filter chỉ từ các biến trên
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const $or = [
                { 'shippingInfo.name': searchRegex },
                { 'shippingInfo.email': searchRegex },
                { 'shippingInfo.phone': searchRegex }
            ];
            if (/^[a-fA-F0-9]{24}$/.test(search.trim())) {
                try {
                    $or.unshift({ _id: new ObjectId(search.trim()) });
                } catch (e) {}
            }
            const dateMatch = search.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
            if (dateMatch) {
                const yyyy = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
                const mm = dateMatch[2].padStart(2, '0');
                const dd = dateMatch[1].padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    const nextDay = new Date(dateObj);
                    nextDay.setDate(nextDay.getDate() + 1);
                    $or.push({ createdAt: { $gte: dateObj, $lt: nextDay } });
                }
            }
            filter.$or = $or;
        }
        if (status && status.trim()) {
            filter.status = status.trim();
        }
        if (payment && payment.trim()) {
            filter.paymentStatus = payment.trim();
        }
        if (method && method.trim()) {
            filter.paymentMethod = method.trim();
        }
        // ... giữ nguyên phần truy vấn và render ...

        // Build sort object
        const sortObject = { createdAt: -1 }; // Default sort by newest first

        // Get total count for pagination
        const db = getDb();
        const totalOrders = await db.collection('orders').countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);
        
        // Get orders with server-side pagination and sorting
        const orders = await db.collection('orders')
            .find(filter)
            .sort(sortObject)
            .skip(skip)
            .limit(limit)
            .toArray();
        
        console.log('Server-side orders search results:', {
            search,
            status,
            payment,
            method,
            totalOrders,
            currentPage: page,
            resultsCount: orders.length
        });

        const paginatedOrders = orders; // Already paginated from database
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        const nextPage = hasNextPage ? page + 1 : null;
        const prevPage = hasPrevPage ? page - 1 : null;
        const pageNumbers = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }

        res.render('admin/orders', {
            pageTitle: 'Quản lý đơn hàng',
            path: '/admin/orders',
            orders: paginatedOrders,
            isAuthenticated: true,
            isAdmin: true,
            currentPage: page,
            totalPages,
            totalOrders,
            hasNextPage,
            hasPrevPage,
            nextPage,
            prevPage,
            pageNumbers
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách đơn hàng:', err);
        console.error('Stack:', err && err.stack);
        console.error('Filter:', JSON.stringify(filter));
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải danh sách đơn hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

// Cập nhật trạng thái đơn hàng
exports.postUpdateOrderStatus = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện thao tác này' });
        }

        const { orderId, status, note } = req.body;
        
        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin cần thiết' });
        }

        // Validate trạng thái hợp lệ
        const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        // Lấy thông tin đơn hàng hiện tại để kiểm tra trạng thái cũ
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const oldStatus = currentOrder.status;
        console.log(`🔍 Debug: Thay đổi trạng thái từ "${oldStatus}" sang "${status}"`);
        
        // ===== VALIDATION CHUYỂN TRẠNG THÁI =====
        // Chặn các chuyển đổi không hợp lệ
        if (oldStatus === 'shipping' && status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể hủy đơn hàng khi đang giao' 
            });
        }
        if (oldStatus === 'delivered' && status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể hủy đơn hàng đã được giao' 
            });
        }
        
        if (oldStatus === 'cancelled' && status !== 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái đơn hàng đã hủy' 
            });
        }
        
        if (oldStatus === 'delivered' && status !== 'delivered') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái đơn hàng đã giao' 
            });
        }

        let result;
        try {
            // Sử dụng updateOrderStatus với note nếu có
            result = await Order.updateOrderStatus(orderId, status, note);
        } catch (error) {
            console.error('❌ Lỗi khi cập nhật trạng thái trong database:', error);
            return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đơn hàng' });
        }
        
        if (result.modifiedCount > 0) {
            // ===== TỰ ĐỘNG CẬP NHẬT THANH TOÁN KHI ĐÃ GIAO HÀNG =====
            if (status === 'delivered' && currentOrder.paymentStatus !== 'paid') {
                if (currentOrder.paymentMethod === 'cod' || currentOrder.paymentStatus === 'pending' || currentOrder.paymentStatus === 'awaiting_payment') {
                    await Order.updatePaymentStatus(orderId, 'paid');
                    console.log('✅ Đã tự động cập nhật trạng thái thanh toán sang Đã thanh toán khi giao hàng:', orderId);
                }
            }
            
            // ===== CẬP NHẬT TỒN KHO THEO TRẠNG THÁI =====
            if (oldStatus === 'pending' && status === 'confirmed') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.updateStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận đơn hàng và cập nhật tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để cập nhật tồn kho cho đơn hàng admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi cập nhật tồn kho cho đơn hàng admin:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            if (oldStatus === 'confirmed' && status === 'cancelled') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.restoreStockForOrder(orderItems);
                        console.log('✅ Admin đã hủy đơn hàng và hoàn lại tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để hoàn lại tồn kho cho đơn hàng admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi hoàn lại tồn kho cho đơn hàng bị hủy:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            // ===== GỬI EMAIL THÔNG BÁO =====
            try {
                const user = await User.findById(currentOrder.userId);
                if (user) {
                    await sendOrderStatusUpdate(currentOrder, user, oldStatus, status);
                    console.log('✅ Đã gửi email thông báo thay đổi trạng thái cho user:', user.email);
                }
            } catch (emailErr) {
                console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái:', emailErr);
                // Không trả về lỗi cho user, chỉ log
            }
            
            // ===== LOG HOẠT ĐỘNG =====
            console.log(`📝 Admin ${req.session.user.email} đã cập nhật đơn hàng ${orderId} từ "${oldStatus}" sang "${status}"`);
            
            res.json({ 
                success: true, 
                message: 'Cập nhật trạng thái đơn hàng thành công',
                oldStatus: oldStatus,
                newStatus: status
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái đơn hàng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái' });
    }
};

// Cập nhật trạng thái đơn hàng theo orderId (cho route /orders/:orderId/update-status)
exports.postUpdateOrderStatusById = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện thao tác này' });
        }

        const { orderId } = req.params;
        const { status, note } = req.body;
        
        if (!status) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin trạng thái' });
        }

        // Validate trạng thái hợp lệ
        const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        // Lấy thông tin đơn hàng hiện tại để kiểm tra trạng thái cũ
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const oldStatus = currentOrder.status;
        console.log(`🔍 Debug: Thay đổi trạng thái từ "${oldStatus}" sang "${status}"`);
        
        // ===== VALIDATION CHUYỂN TRẠNG THÁI =====
        // Chặn các chuyển đổi không hợp lệ
        if (oldStatus === 'shipping' && status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể hủy đơn hàng khi đang giao' 
            });
        }
        if (oldStatus === 'delivered' && status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể hủy đơn hàng đã được giao' 
            });
        }
        
        if (oldStatus === 'cancelled' && status !== 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái đơn hàng đã hủy' 
            });
        }
        
        if (oldStatus === 'delivered' && status !== 'delivered') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái đơn hàng đã giao' 
            });
        }

        let result;
        try {
            // Sử dụng updateOrderStatus với note nếu có
            result = await Order.updateOrderStatus(orderId, status, note);
        } catch (error) {
            console.error('❌ Lỗi khi cập nhật trạng thái trong database:', error);
            return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đơn hàng' });
        }
        
        if (result.modifiedCount > 0) {
            // ===== TỰ ĐỘNG CẬP NHẬT THANH TOÁN KHI ĐÃ GIAO HÀNG =====
            if (status === 'delivered' && currentOrder.paymentStatus !== 'paid') {
                if (currentOrder.paymentMethod === 'cod' || currentOrder.paymentStatus === 'pending' || currentOrder.paymentStatus === 'awaiting_payment') {
                    await Order.updatePaymentStatus(orderId, 'paid');
                    console.log('✅ Đã tự động cập nhật trạng thái thanh toán sang Đã thanh toán khi giao hàng:', orderId);
                }
            }
            
            // ===== CẬP NHẬT TỒN KHO THEO TRẠNG THÁI =====
            if (oldStatus === 'pending' && status === 'confirmed') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.updateStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận đơn hàng và cập nhật tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để cập nhật tồn kho cho đơn hàng admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi cập nhật tồn kho cho đơn hàng admin:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            if (oldStatus === 'confirmed' && status === 'cancelled') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.restoreStockForOrder(orderItems);
                        console.log('✅ Admin đã hủy đơn hàng và hoàn lại tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để hoàn lại tồn kho cho đơn hàng admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi hoàn lại tồn kho cho đơn hàng bị hủy:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            // ===== GỬI EMAIL THÔNG BÁO =====
            try {
                const user = await User.findById(currentOrder.userId);
                if (user) {
                    await sendOrderStatusUpdate(currentOrder, user, oldStatus, status);
                    console.log('✅ Đã gửi email thông báo thay đổi trạng thái cho user:', user.email);
                }
            } catch (emailErr) {
                console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái:', emailErr);
                // Không trả về lỗi cho user, chỉ log
            }
            
            // ===== LOG HOẠT ĐỘNG =====
            console.log(`📝 Admin ${req.session.user.email} đã cập nhật đơn hàng ${orderId} từ "${oldStatus}" sang "${status}"`);
            
            res.json({ 
                success: true, 
                message: 'Cập nhật trạng thái đơn hàng thành công',
                oldStatus: oldStatus,
                newStatus: status
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái đơn hàng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái' });
    }
};

// Cập nhật trạng thái thanh toán
exports.postUpdatePaymentStatus = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện thao tác này' });
        }

        const { orderId, paymentStatus, note } = req.body;
        
        if (!orderId || !paymentStatus) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin cần thiết' });
        }

        // Validate trạng thái thanh toán hợp lệ
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded', 'processing'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Trạng thái thanh toán không hợp lệ' });
        }

        // Lấy thông tin đơn hàng hiện tại để kiểm tra trạng thái thanh toán cũ
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const oldPaymentStatus = currentOrder.paymentStatus;
        console.log(`🔍 Debug: Thay đổi trạng thái thanh toán từ "${oldPaymentStatus}" sang "${paymentStatus}"`);
        
        // ===== VALIDATION CHUYỂN TRẠNG THÁI THANH TOÁN =====
        // Chặn các chuyển đổi không hợp lệ
        if (oldPaymentStatus === 'refunded' && paymentStatus !== 'refunded') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái thanh toán đã hoàn tiền' 
            });
        }
        
        if (oldPaymentStatus === 'paid' && paymentStatus === 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể chuyển từ đã thanh toán về chờ thanh toán' 
            });
        }

        const result = await Order.updatePaymentStatus(orderId, paymentStatus);
        
        if (result.modifiedCount > 0) {
            // ===== CẬP NHẬT TỒN KHO THEO TRẠNG THÁI THANH TOÁN =====
            if ((oldPaymentStatus === 'pending' || oldPaymentStatus === 'awaiting') && paymentStatus === 'paid') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.updateStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận thanh toán và cập nhật tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để cập nhật tồn kho cho thanh toán admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi cập nhật tồn kho cho thanh toán admin:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            if (oldPaymentStatus === 'paid' && paymentStatus === 'failed') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.restoreStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận thanh toán thất bại và hoàn lại tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để hoàn lại tồn kho cho thanh toán thất bại:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi hoàn lại tồn kho cho thanh toán thất bại:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            // ===== GỬI EMAIL THÔNG BÁO =====
            try {
                const user = await User.findById(currentOrder.userId);
                if (user) {
                    await sendPaymentStatusUpdate(currentOrder, user, oldPaymentStatus, paymentStatus);
                    console.log('✅ Đã gửi email thông báo thay đổi trạng thái thanh toán cho user:', user.email);
                }
            } catch (emailErr) {
                console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái thanh toán:', emailErr);
                // Không trả về lỗi cho user, chỉ log
            }
            
            // ===== LOG HOẠT ĐỘNG =====
            console.log(`📝 Admin ${req.session.user.email} đã cập nhật trạng thái thanh toán đơn hàng ${orderId} từ "${oldPaymentStatus}" sang "${paymentStatus}"`);
            
            res.json({ 
                success: true, 
                message: 'Cập nhật trạng thái thanh toán thành công',
                oldPaymentStatus: oldPaymentStatus,
                newPaymentStatus: paymentStatus
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái thanh toán:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái thanh toán' });
    }
};

// Cập nhật trạng thái thanh toán theo orderId (cho route /orders/:orderId/update-payment-status)
exports.postUpdatePaymentStatusById = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện thao tác này' });
        }

        const { orderId } = req.params;
        const { paymentStatus, note } = req.body;
        
        if (!paymentStatus) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin trạng thái thanh toán' });
        }

        // Validate trạng thái thanh toán hợp lệ
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded', 'processing'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Trạng thái thanh toán không hợp lệ' });
        }

        // Lấy thông tin đơn hàng hiện tại để kiểm tra trạng thái thanh toán cũ
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const oldPaymentStatus = currentOrder.paymentStatus;
        console.log(`🔍 Debug: Thay đổi trạng thái thanh toán từ "${oldPaymentStatus}" sang "${paymentStatus}"`);
        
        // ===== VALIDATION CHUYỂN TRẠNG THÁI THANH TOÁN =====
        // Chặn các chuyển đổi không hợp lệ
        if (oldPaymentStatus === 'refunded' && paymentStatus !== 'refunded') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể thay đổi trạng thái thanh toán đã hoàn tiền' 
            });
        }
        
        if (oldPaymentStatus === 'paid' && paymentStatus === 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể chuyển từ đã thanh toán về chờ thanh toán' 
            });
        }

        const result = await Order.updatePaymentStatus(orderId, paymentStatus);
        
        if (result.modifiedCount > 0) {
            // ===== CẬP NHẬT TỒN KHO THEO TRẠNG THÁI THANH TOÁN =====
            if ((oldPaymentStatus === 'pending' || oldPaymentStatus === 'awaiting') && paymentStatus === 'paid') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.updateStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận thanh toán và cập nhật tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để cập nhật tồn kho cho thanh toán admin:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi cập nhật tồn kho cho thanh toán admin:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            if (oldPaymentStatus === 'paid' && paymentStatus === 'failed') {
                try {
                    const orderItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
                        ? currentOrder.items
                        : (Array.isArray(currentOrder.products) ? currentOrder.products : []);
                    
                    if (orderItems && orderItems.length > 0) {
                        await Product.restoreStockForOrder(orderItems);
                        console.log('✅ Admin đã xác nhận thanh toán thất bại và hoàn lại tồn kho:', orderId);
                    } else {
                        console.warn('⚠️ Không có sản phẩm nào để hoàn lại tồn kho cho thanh toán thất bại:', orderId);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi hoàn lại tồn kho cho thanh toán thất bại:', err);
                    // Không trả về lỗi cho user, chỉ log
                }
            }
            
            // ===== GỬI EMAIL THÔNG BÁO =====
            try {
                const user = await User.findById(currentOrder.userId);
                if (user) {
                    await sendPaymentStatusUpdate(currentOrder, user, oldPaymentStatus, paymentStatus);
                    console.log('✅ Đã gửi email thông báo thay đổi trạng thái thanh toán cho user:', user.email);
                }
            } catch (emailErr) {
                console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái thanh toán:', emailErr);
                // Không trả về lỗi cho user, chỉ log
            }
            
            // ===== LOG HOẠT ĐỘNG =====
            console.log(`📝 Admin ${req.session.user.email} đã cập nhật trạng thái thanh toán đơn hàng ${orderId} từ "${oldPaymentStatus}" sang "${paymentStatus}"`);
            
            res.json({ 
                success: true, 
                message: 'Cập nhật trạng thái thanh toán thành công',
                oldPaymentStatus: oldPaymentStatus,
                newPaymentStatus: paymentStatus
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái thanh toán:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái thanh toán' });
    }
};

// Xem chi tiết đơn hàng
exports.getOrderDetail = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Bạn không có quyền truy cập trang này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: false
            });
        }

        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).render('error/404', {
                pageTitle: 'Không tìm thấy',
                path: '/error',
                message: 'Không tìm thấy đơn hàng',
                isAuthenticated: true,
                isAdmin: true
            });
        }
        
        if (!order.shippingInfo || !order.items || !Array.isArray(order.items) || order.items.length === 0 || typeof order.totalPrice !== 'number') {
            return res.status(400).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Đơn hàng này thiếu thông tin cần thiết (khách, sản phẩm hoặc tổng tiền), không thể xem chi tiết.',
                isAuthenticated: true,
                isAdmin: true
            });
        }

        res.render('admin/order-detail', {
            pageTitle: `Chi tiết đơn hàng ${order._id}`,
            path: '/admin/orders',
            order: order,
            isAuthenticated: true,
            isAdmin: true
        });
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết đơn hàng:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải chi tiết đơn hàng',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.deleteOrder = async (req, res, next) => {
    try {
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện thao tác này' });
        }
        const orderId = req.params.orderId;
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể xoá đơn hàng ở trạng thái Chờ xác nhận!' });
        }
        await Order.deleteById(orderId);
        res.json({ success: true });
    } catch (err) {
        console.error('Lỗi khi xoá đơn hàng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi xoá đơn hàng' });
    }
};

// Gửi lại hóa đơn cho khách hàng
exports.resendInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const db = getDb();
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }
        // Lấy thông tin user/email
        const email = order.shippingInfo?.email;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Đơn hàng không có email khách hàng' });
        }
        // Sinh file PDF hóa đơn
        const pdfPath = await generateOrderPDF(order, null); // null nếu không cần user
        // Gửi mail kèm file
        await emailService.sendMailWithAttachment({
            to: email,
            subject: `Hóa đơn đơn hàng #${order._id.toString().slice(-8)}`,
            text: 'Xin chào, vui lòng xem hóa đơn đính kèm cho đơn hàng của bạn!',
            attachments: [
                {
                    filename: `invoice-${order._id.toString().slice(-8)}.pdf`,
                    path: pdfPath
                }
            ]
        });
        // Xóa file PDF sau khi gửi (nếu muốn)
        fs.unlink(pdfPath, () => {});
        res.json({ success: true });
    } catch (err) {
        console.error('Lỗi gửi lại hóa đơn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi gửi lại hóa đơn' });
    }
};

// These functions were found in routes but not in controller, adding them here.
// It's possible they are defined elsewhere or are placeholders.
// If they are placeholders, you may need to implement them.
exports.sendOrderNotification = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
};

exports.printOrder = async (req, res, next) => {
    // Implementation needed
    res.status(501).send('Not Implemented');
}; 