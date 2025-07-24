const Booking = require('../../models/booking');
const emailService = require('../../util/email-service');

exports.getBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.fetchAll();
        res.render('admin/bookings', {
            pageTitle: 'Quản lý lịch hẹn',
            path: '/admin/bookings',
            bookings: bookings
        });
    } catch (err) {
        next(err);
    }
};

exports.updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await Booking.updateStatus(req.params.id, status);
        res.redirect('/admin/bookings');
    } catch (err) {
        next(err);
    }
};

exports.approveBooking = async (req, res, next) => {
    try {
        await Booking.updateStatus(req.params.id, 'confirmed');
        // Gửi email xác nhận cho khách
        const booking = await Booking.findById(req.params.id);
        if (booking && booking.customerInfo?.email) {
            const detailHtml = `
                <p>Chào <b>${booking.customerInfo.name}</b>,</p>
                <p>Lịch dịch vụ của bạn đã được <b>xác nhận</b> với thông tin sau:</p>
                <ul>
                    <li><b>Dịch vụ:</b> ${booking.serviceName || booking.service?.name || ''}</li>
                    <li><b>Ngày:</b> ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('vi-VN') : ''}</li>
                    <li><b>Giờ:</b> ${booking.timeSlot?.start || ''} - ${booking.timeSlot?.end || ''}</li>
                    <li><b>Thú cưng:</b> ${booking.customerInfo?.petInfo?.name || ''} (${booking.customerInfo?.petInfo?.type || ''})</li>
                    <li><b>Ghi chú:</b> ${booking.notes || ''}</li>
                </ul>
                <p style='color:green'><b>Trạng thái: Đã xác nhận</b></p>
                <p>Cảm ơn bạn đã tin tưởng sử dụng dịch vụ!</p>
            `;
            await emailService.sendEmail(
                booking.customerInfo.email,
                'Xác nhận đặt lịch dịch vụ',
                detailHtml
            );
        }
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true });
        }
        res.redirect('/admin/bookings');
    } catch (err) {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi duyệt booking' });
        }
        next(err);
    }
};

exports.rejectBooking = async (req, res, next) => {
    try {
        await Booking.updateStatus(req.params.id, 'cancelled');
        // Gửi email từ chối cho khách
        const booking = await Booking.findById(req.params.id);
        if (booking && booking.customerInfo?.email) {
            const detailHtml = `
                <p>Chào <b>${booking.customerInfo.name}</b>,</p>
                <p>Rất tiếc, lịch dịch vụ bạn đặt đã bị <b>từ chối</b> do có người khác được duyệt trước.</p>
                <ul>
                    <li><b>Dịch vụ:</b> ${booking.serviceName || booking.service?.name || ''}</li>
                    <li><b>Ngày:</b> ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('vi-VN') : ''}</li>
                    <li><b>Giờ:</b> ${booking.timeSlot?.start || ''} - ${booking.timeSlot?.end || ''}</li>
                    <li><b>Thú cưng:</b> ${booking.customerInfo?.petInfo?.name || ''} (${booking.customerInfo?.petInfo?.type || ''})</li>
                    <li><b>Ghi chú:</b> ${booking.notes || ''}</li>
                </ul>
                <p style='color:red'><b>Trạng thái: Đã bị từ chối</b></p>
                <p>Bạn vui lòng chọn khung giờ khác hoặc liên hệ để được hỗ trợ!</p>
            `;
            await emailService.sendEmail(
                booking.customerInfo.email,
                'Lịch đặt bị từ chối',
                detailHtml
            );
        }
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true });
        }
        res.redirect('/admin/bookings');
    } catch (err) {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi từ chối booking' });
        }
        next(err);
    }
};

exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        await Booking.deleteById(req.params.id);
        // Gửi email thông báo nếu cần
        if (booking && booking.customerInfo?.email) {
            await emailService.sendEmail(
                booking.customerInfo.email,
                'Lịch đặt bị hủy',
                `<p>Lịch bạn đặt đã bị hủy bởi quản trị viên.</p>`
            );
        }
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Deleting booking failed.' });
    }
}; 