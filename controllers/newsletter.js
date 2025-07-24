const Contact = require('../models/contact');
const emailService = require('../util/email-service');

exports.subscribe = async (req, res, next) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // ===== VALIDATION DỮ LIỆU ĐẦU VÀO =====
        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email'
            });
        }

        // ===== KIỂM TRA ĐỊNH DẠNG EMAIL =====
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }

        // ===== KIỂM TRA SPAM VÀ RATE LIMITING =====
        const spamCheck = await Contact.checkSpamAndRateLimit(email, 'newsletter', ipAddress);
        if (!spamCheck.allowed) {
            return res.status(429).json({
                success: false,
                message: spamCheck.message
            });
        }

        // ===== KIỂM TRA EMAIL ĐÃ ĐĂNG KÝ CHƯA =====
        const existingContact = await Contact.findByEmail(email, 'newsletter');
        if (existingContact) {
            if (existingContact.status === 'approved') {
                return res.status(400).json({
                    success: false,
                    message: 'Email này đã được đăng ký newsletter'
                });
            } else if (existingContact.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Email này đang chờ xác nhận. Vui lòng kiểm tra email của bạn.'
                });
            } else if (existingContact.status === 'rejected') {
                return res.status(400).json({
                    success: false,
                    message: 'Email này đã bị từ chối đăng ký newsletter'
                });
            }
        }

        // ===== TẠO NEWSLETTER SUBSCRIPTION =====
        const contact = new Contact({
            email: email.trim().toLowerCase(),
            type: 'newsletter',
            status: 'pending',
            ipAddress: ipAddress
        });

        const savedContact = await contact.save();

        // ===== GỬI EMAIL XÁC NHẬN =====
        try {
            await emailService.sendNewsletterConfirmation({
                email: savedContact.email,
                subscriptionId: savedContact._id
            });
        } catch (emailError) {
            console.error('Lỗi khi gửi email xác nhận newsletter:', emailError);
        }

        console.log(`📧 Newsletter subscription mới: ${email}`);

        res.json({
            success: true,
            message: 'Đăng ký newsletter thành công! Vui lòng kiểm tra email để xác nhận.'
        });

    } catch (err) {
        console.error('Lỗi khi đăng ký newsletter:', err);
        
        if (err.message.includes('Email không hợp lệ')) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi đăng ký newsletter. Vui lòng thử lại sau.'
        });
    }
};

exports.unsubscribe = async (req, res, next) => {
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

exports.getSubscriberCount = async (req, res, next) => {
    try {
        const count = await Contact.getNewsletterSubscriberCount();
        res.status(200).json({
            success: true,
            count: count
        });
    } catch (error) {
        console.error('❌ Lỗi lấy số lượng subscriber:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi lấy thông tin'
        });
    }
}; 