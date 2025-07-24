const mongodb = require('mongodb');
const getDb = require('../util/database').getDb;

class Booking {
    constructor(userId, serviceId, customerInfo, bookingDate, timeSlot, notes = '', status = 'pending') {
        this.userId = userId;
        this.serviceId = new mongodb.ObjectId(serviceId);
        this.customerInfo = customerInfo; // { name, phone, email, petInfo }
        this.bookingDate = new Date(bookingDate);
        this.timeSlot = timeSlot; // { start: '09:00', end: '10:00' }
        this.notes = notes;
        this.status = status; // pending, confirmed, completed, cancelled
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    async save() {
        try {
            const db = getDb();
            const result = await db.collection('bookings').insertOne(this);
            console.log('Đặt lịch mới đã được tạo:', result);
            return result;
        } catch (err) {
            console.error('Lỗi khi lưu đặt lịch:', err);
            throw err;
        }
    }

    static async findByUserId(userId) {
        try {
            const db = getDb();
            const bookings = await db.collection('bookings')
                .find({ userId })
                .sort({ createdAt: -1 })
                .toArray();
            return bookings;
        } catch (err) {
            console.error('Lỗi khi lấy lịch đặt của user:', err);
            throw err;
        }
    }

    static async findById(bookingId) {
        try {
            const db = getDb();
            const booking = await db.collection('bookings')
                .findOne({ _id: new mongodb.ObjectId(bookingId) });
            return booking;
        } catch (err) {
            console.error('Lỗi khi tìm đặt lịch:', err);
            throw err;
        }
    }

    static async updateStatus(bookingId, status) {
        try {
            const db = getDb();
            const result = await db.collection('bookings')
                .updateOne(
                    { _id: new mongodb.ObjectId(bookingId) },
                    { 
                        $set: { 
                            status, 
                            updatedAt: new Date() 
                        } 
                    }
                );
            return result;
        } catch (err) {
            console.error('Lỗi khi cập nhật trạng thái đặt lịch:', err);
            throw err;
        }
    }

    static async fetchAll(limit = 20, skip = 0, status = null) {
        try {
            const db = getDb();
            let filter = {};
            
            if (status && status !== 'all') {
                filter.status = status;
            }

            const bookings = await db.collection('bookings')
                .find(filter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .toArray();
            
            return bookings;
        } catch (err) {
            console.error('Lỗi khi lấy danh sách đặt lịch:', err);
            throw err;
        }
    }

    // Kiểm tra trùng lịch đặt
    static async checkBookingConflict(serviceId, bookingDate, timeSlot, excludeBookingId = null) {
        try {
            const db = getDb();
            const startTime = new Date(bookingDate + ' ' + timeSlot.start);
            const endTime = new Date(bookingDate + ' ' + timeSlot.end);
            
            let filter = {
                serviceId: new mongodb.ObjectId(serviceId),
                bookingDate: {
                    $gte: new Date(bookingDate + ' 00:00:00'),
                    $lt: new Date(bookingDate + ' 23:59:59')
                },
                status: { $in: ['pending', 'confirmed'] } // Chỉ kiểm tra các booking đang hoạt động
            };
            
            if (excludeBookingId) {
                filter._id = { $ne: new mongodb.ObjectId(excludeBookingId) };
            }
            
            const conflictingBookings = await db.collection('bookings')
                .find(filter)
                .toArray();
            
            // Kiểm tra xem có trùng thời gian không
            for (const booking of conflictingBookings) {
                const existingStart = new Date(booking.bookingDate + ' ' + booking.timeSlot.start);
                const existingEnd = new Date(booking.bookingDate + ' ' + booking.timeSlot.end);
                
                if ((startTime < existingEnd && endTime > existingStart)) {
                    return {
                        hasConflict: true,
                        conflictingBooking: booking,
                        message: `Thời gian này đã được đặt bởi khách hàng khác`
                    };
                }
            }
            
            return { hasConflict: false };
        } catch (err) {
            console.error('Lỗi khi kiểm tra trùng lịch:', err);
            throw err;
        }
    }

    // Kiểm tra tính hợp lệ của thời gian đặt lịch
    static validateBookingTime(bookingDate, timeSlot) {
        const now = new Date();
        const selectedDate = new Date(bookingDate);
        const selectedTime = new Date(bookingDate + ' ' + timeSlot.start);
        
        // Kiểm tra ngày đặt phải trong tương lai
        if (selectedDate <= now) {
            return {
                valid: false,
                message: 'Ngày đặt lịch phải trong tương lai'
            };
        }
        
        // Kiểm tra giờ làm việc (8:00 - 18:00)
        const hour = selectedTime.getHours();
        if (hour < 8 || hour >= 18) {
            return {
                valid: false,
                message: 'Giờ đặt lịch phải trong khoảng 8:00 - 18:00'
            };
        }
        
        // Kiểm tra thời gian tối thiểu trước khi đặt (2 giờ)
        const minBookingTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        if (selectedTime < minBookingTime) {
            return {
                valid: false,
                message: 'Phải đặt lịch trước ít nhất 2 giờ'
            };
        }
        
        return { valid: true };
    }

    // Lấy danh sách slot thời gian khả dụng
    static async getAvailableTimeSlots(serviceId, bookingDate) {
        try {
            const db = getDb();
            const timeSlots = [
                { start: '08:00', end: '09:00' },
                { start: '09:00', end: '10:00' },
                { start: '10:00', end: '11:00' },
                { start: '11:00', end: '12:00' },
                { start: '13:00', end: '14:00' },
                { start: '14:00', end: '15:00' },
                { start: '15:00', end: '16:00' },
                { start: '16:00', end: '17:00' },
                { start: '17:00', end: '18:00' }
            ];
            
            // Lấy các booking đã có trong ngày
            const existingBookings = await db.collection('bookings')
                .find({
                    serviceId: new mongodb.ObjectId(serviceId),
                    bookingDate: {
                        $gte: new Date(bookingDate + ' 00:00:00'),
                        $lt: new Date(bookingDate + ' 23:59:59')
                    },
                    status: { $in: ['pending', 'confirmed'] }
                })
                .toArray();
            
            // Lọc ra các slot còn trống
            const availableSlots = timeSlots.filter(slot => {
                const slotStart = new Date(bookingDate + ' ' + slot.start);
                const slotEnd = new Date(bookingDate + ' ' + slot.end);
                
                return !existingBookings.some(booking => {
                    const bookingStart = new Date(booking.bookingDate + ' ' + booking.timeSlot.start);
                    const bookingEnd = new Date(booking.bookingDate + ' ' + booking.timeSlot.end);
                    
                    return (slotStart < bookingEnd && slotEnd > bookingStart);
                });
            });
            
            return availableSlots;
        } catch (err) {
            console.error('Lỗi khi lấy slot thời gian khả dụng:', err);
            throw err;
        }
    }

    static async deleteById(bookingId) {
        try {
            const db = getDb();
            const result = await db.collection('bookings').deleteOne({ _id: new mongodb.ObjectId(bookingId) });
            return result;
        } catch (err) {
            console.error('Lỗi khi xóa đặt lịch:', err);
            throw err;
        }
    }
}

module.exports = Booking;