const Contact = require('../models/contact');
const emailService = require('../util/email-service');

exports.submitContact = async (req, res, next) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // ===== VALIDATION DỮ LIỆU ĐẦU VÀO =====
        if (!email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Email và nội dung tin nhắn là bắt buộc'
            });
        }

        // ===== KIỂM TRA SPAM VÀ RATE LIMITING =====
        const spamCheck = await Contact.checkSpamAndRateLimit(email, 'contact', ipAddress);
        if (!spamCheck.allowed) {
            return res.status(429).json({
                success: false,
                message: spamCheck.message
            });
        }

        // ===== TẠO CONTACT MỚI =====
        const contactData = {
            email,
            name: name || null,
            phone: phone || null,
            subject: subject || 'Liên hệ từ website',
            message,
            type: 'contact',
            ipAddress: ipAddress
        };

        const contact = new Contact(contactData);
        const savedContact = await contact.save();

        // ===== GỬI EMAIL THÔNG BÁO CHO ADMIN =====
        try {
            await emailService.sendContactNotification({
                name: savedContact.name || 'Khách hàng',
                email: savedContact.email,
                phone: savedContact.phone || 'Không có',
                subject: savedContact.subject,
                message: savedContact.message,
                contactId: savedContact._id
            });
        } catch (emailError) {
            console.error('Lỗi khi gửi email thông báo contact:', emailError);
        }

        // ===== GỬI EMAIL XÁC NHẬN CHO KHÁCH HÀNG =====
        try {
            await emailService.sendContactConfirmation({
                name: savedContact.name || 'Khách hàng',
                email: savedContact.email,
                subject: savedContact.subject,
                message: savedContact.message
            });
        } catch (emailError) {
            console.error('Lỗi khi gửi email xác nhận contact:', emailError);
        }

        console.log(`📧 Contact mới từ ${email}: ${savedContact.subject}`);

        res.json({
            success: true,
            message: 'Tin nhắn đã được gửi thành công! Chúng tôi sẽ phản hồi sớm nhất.'
        });

    } catch (err) {
        console.error('Lỗi khi xử lý contact form:', err);
        
        if (err.message.includes('Email không hợp lệ')) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }
        
        if (err.message.includes('Tên phải từ 2-50 ký tự')) {
            return res.status(400).json({
                success: false,
                message: 'Tên phải từ 2-50 ký tự'
            });
        }
        
        if (err.message.includes('Số điện thoại phải có 10-11 chữ số')) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại phải có 10-11 chữ số'
            });
        }
        
        if (err.message.includes('Chủ đề phải từ 5-100 ký tự')) {
            return res.status(400).json({
                success: false,
                message: 'Chủ đề phải từ 5-100 ký tự'
            });
        }
        
        if (err.message.includes('Nội dung tin nhắn phải từ 10-2000 ký tự')) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung tin nhắn phải từ 10-2000 ký tự'
            });
        }
        
        if (err.message.includes('Nội dung tin nhắn chứa từ khóa không hợp lệ')) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung tin nhắn chứa từ khóa không hợp lệ'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.'
        });
    }
};

// Newsletter subscription handler
exports.handleNewsletterSubscription = async (req, res, next) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }

        // Save to database using unified contact model
        const contact = new Contact({
            type: 'newsletter',
            email: email.trim()
        });
        const result = await contact.save();

        // Send confirmation email using email service
        const emailResult = await emailService.sendNewsletterConfirmation(email);
        if (!emailResult.success) {
            console.error('❌ Lỗi khi gửi email xác nhận newsletter:', emailResult.error);
        }

        res.status(200).json({
            success: true,
            message: 'Đăng ký nhận tin tức thành công! Vui lòng kiểm tra email để xác nhận.',
            data: result
        });

    } catch (error) {
        console.error('❌ Lỗi đăng ký newsletter:', error);
        
        if (error.message === 'Email này đã được đăng ký nhận tin tức') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.'
        });
    }
};

// Newsletter unsubscribe handler
exports.handleNewsletterUnsubscribe = async (req, res, next) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email không được cung cấp'
            });
        }

        const result = await Contact.unsubscribe(email);

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Email này chưa được đăng ký nhận tin tức'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Đã hủy đăng ký nhận tin tức thành công'
        });

    } catch (error) {
        console.error('❌ Lỗi hủy đăng ký newsletter:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi hủy đăng ký. Vui lòng thử lại sau.'
        });
    }
}; 