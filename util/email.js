const nodemailer = require('nodemailer');
require('dotenv').config();

// Tạo transporter với cấu hình Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Kiểm tra kết nối mail
transporter.verify(function (error, success) {
    if (error) {
        console.log('Lỗi kết nối email:', error);
    } else {
        console.log('✅ Kết nối email thành công!');
    }
});

// Helper để hiển thị tên phương thức/thanh toán
function getPaymentMethodDisplay(method) {
    const methods = {
        'cod': 'Thanh toán khi nhận hàng (COD)',
        'bank': 'Chuyển khoản ngân hàng',
        'bank_transfer': 'Chuyển khoản QR Code',
        'ewallet': 'Ví điện tử',
        'credit': 'Thẻ tín dụng/ghi nợ',
        'vnpay': 'Thanh toán qua VNPay'
    };
    return methods[method] || 'Không xác định';
}

function getPaymentStatusDisplay(status) {
    const statuses = {
        'pending': 'Chờ thanh toán',
        'awaiting_payment': 'Chờ chuyển khoản',
        'processing': 'Đang xử lý',
        'completed': 'Đã thanh toán',
        'paid': 'Đã thanh toán',
        'failed': 'Thanh toán thất bại',
        'refunded': 'Đã hoàn tiền'
    };
    return statuses[status] || 'Không xác định';
}

// Hàm gửi email chung
const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email đã gửi:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error);
    return false;
  }
};

// Gửi email xác nhận đơn hàng cho khách hàng
const sendOrderConfirmation = async (orderOrId, user) => {
    try {
        let order;
        const Order = require('../models/order');
        
        if (typeof orderOrId === 'string' || orderOrId instanceof require('mongodb').ObjectId) {
            order = await Order.findById(orderOrId);
        } else {
            order = orderOrId;
        }

        if (!order) {
            console.error('Không tìm thấy đơn hàng để gửi email xác nhận:', orderOrId);
            return false;
        }

        const customerEmail = order.shippingInfo?.email || user.email;
        const customerName = order.shippingInfo?.name || user.name;
        
        const subject = '🎉 Xác nhận đơn hàng thành công - Pet Store';
        const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #28a745; margin: 0;">🎉 Đặt hàng thành công!</h1>
                            <p style="color: #666; margin: 10px 0;">Cảm ơn bạn đã đặt hàng tại Pet Store</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #333; margin-top: 0;">📋 Chi tiết đơn hàng</h2>
                            <p><strong>Mã đơn hàng:</strong> <span style="color: #007bff; font-weight: bold;">${order._id}</span></p>
                            <p><strong>Phí vận chuyển:</strong> ${(order.shippingFee || 0).toLocaleString('vi-VN')} VNĐ</p>
                            <p><strong>Tổng tiền:</strong> <span style="color: #dc3545; font-weight: bold; font-size: 18px;">${order.totalPrice.toLocaleString('vi-VN')} VNĐ</span></p>
                            <p><strong>Thời gian đặt hàng:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🚚 Thông tin giao hàng</h3>
                            <p><strong>Họ tên:</strong> ${order.shippingInfo?.name}</p>
                            <p><strong>Điện thoại:</strong> ${order.shippingInfo?.phone}</p>
                            <p><strong>Email:</strong> ${order.shippingInfo?.email}</p>
                            <p><strong>Địa chỉ:</strong> ${order.shippingInfo?.address}</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">💳 Thông tin thanh toán</h3>
                            <p><strong>Phương thức:</strong> ${getPaymentMethodDisplay(order.paymentMethod)}</p>
                            <p><strong>Trạng thái:</strong> <span style="color: #28a745; font-weight: bold;">${getPaymentStatusDisplay(order.paymentStatus || 'pending')}</span></p>
                            ${order.paymentMethod === 'bank' && order.paymentStatus === 'awaiting' ? `
                                <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 10px 0;">
                                    <h4 style="margin-top: 0;">🏦 Thông tin chuyển khoản</h4>
                                    <p><strong>Ngân hàng:</strong> Vietcombank</p>
                                    <p><strong>Số tài khoản:</strong> 1234567890</p>
                                    <p><strong>Chủ tài khoản:</strong> Pet Store</p>
                                    <p><strong>Nội dung:</strong> DH${order._id}</p>
                                    <p><strong>Số tiền:</strong> ${order.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                                </div>
                            ` : ''}
                            ${order.paymentMethod === 'ewallet' && order.paymentStatus === 'awaiting' ? `
                                <div style="background-color: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50; margin: 10px 0;">
                                    <h4 style="margin-top: 0;">📱 Thông tin thanh toán ví điện tử</h4>
                                    <p><strong>Tên:</strong> Pet Store</p>
                                    <p><strong>Nội dung:</strong> DH${order._id}</p>
                                    <p><strong>Số tiền:</strong> ${order.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🛍️ Danh sách sản phẩm</h3>
                            <div style="margin-bottom: 10px;">
                                ${order.items.map(item => `
                                    <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                                        <p style="margin: 5px 0;"><strong>${item.title}</strong></p>
                                        <p style="margin: 5px 0; color: #666;">Số lượng: ${item.quantity} | Giá: ${item.price.toLocaleString('vi-VN')} VNĐ</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3 style="color: #28a745; margin-top: 0;">✅ Trạng thái đơn hàng</h3>
                            <p style="font-size: 18px; font-weight: bold; color: #28a745;">${getOrderStatusDisplay(order.status || 'pending')}</p>
                            <p style="color: #666;">Chúng tôi sẽ liên hệ với bạn sớm nhất!</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #666; margin: 0;">Trân trọng,<br><strong>Pet Store</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                        </div>
                    </div>
                </div>
            `;
        // Log chi tiết trước khi gửi mail
        console.log('[EMAIL][XÁC NHẬN ĐƠN HÀNG] Chuẩn bị gửi tới:', customerEmail);
        console.log('[EMAIL][XÁC NHẬN ĐƠN HÀNG] Tiêu đề:', subject);
        console.log('[EMAIL][XÁC NHẬN ĐƠN HÀNG] Nội dung rút gọn:', html.slice(0, 200) + '...');
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: subject,
            html: html
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email xác nhận đơn hàng đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email xác nhận:', error);
        return false;
    }
};

// Gửi email mật khẩu mới
const sendNewPassword = async (user, newPassword) => {
    try {
        const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: '🔐 Mật khẩu mới - Pet Store',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #28a745; margin: 0;">🔐 Mật khẩu mới</h1>
                            <p style="color: #666; margin: 10px 0;">Xin chào ${user.name}!</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #333; margin-top: 0;">📧 Yêu cầu lấy lại mật khẩu</h2>
                            <p>Chúng tôi nhận được yêu cầu lấy lại mật khẩu cho tài khoản của bạn tại Pet Store.</p>
                            <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này và liên hệ hỗ trợ ngay.</p>
                        </div>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <h3 style="color: #28a745; margin-top: 0;">🔢 Mật khẩu mới của bạn</h3>
                            <div style="background-color: #ffffff; border: 2px dashed #28a745; padding: 15px; margin: 15px 0; border-radius: 8px;">
                                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #28a745; letter-spacing: 3px; font-family: monospace;">
                                    ${newPassword}
                                </p>
                            </div>
                            <p style="color: #666; font-size: 14px;">Mật khẩu này có 6 chữ số</p>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <h3 style="color: #1976d2; margin-top: 0;">🚀 Đăng nhập ngay</h3>
                            <p style="margin-bottom: 20px;">Click vào nút bên dưới để đăng nhập với mật khẩu mới:</p>
                            <a href="${loginUrl}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                🔐 Đăng nhập ngay
                            </a>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #856404; margin-top: 0;">⚠️ Lưu ý quan trọng</h3>
                            <ul style="color: #856404; margin: 0; padding-left: 20px;">
                                <li>Mật khẩu này chỉ được gửi qua email</li>
                                <li>Vui lòng đổi mật khẩu sau khi đăng nhập thành công</li>
                                <li>Không chia sẻ mật khẩu này với người khác</li>
                                <li>Nếu bạn không yêu cầu, vui lòng liên hệ hỗ trợ ngay</li>
                            </ul>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🔗 Link đăng nhập thay thế</h3>
                            <p>Nếu nút trên không hoạt động, bạn có thể copy link sau vào trình duyệt:</p>
                            <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #495057;">
                                ${loginUrl}
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #666; margin: 0;">Trân trọng,<br><strong>Pet Store</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                        </div>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email mật khẩu mới đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email mật khẩu mới:', error);
        return false;
    }
};

// Gửi email thông báo đơn hàng mới cho admin
const sendNewOrderNotification = async (order, user) => {
    try {
        const customerName = order.shippingInfo?.name || user.name;
        const customerEmail = order.shippingInfo?.email || user.email;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `🔔 Đơn hàng mới từ ${customerName} - ${order._id}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #007bff; margin: 0;">🔔 Đơn hàng mới!</h1>
                            <p style="color: #666; margin: 10px 0;">Có đơn hàng mới cần xử lý</p>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #1976d2; margin-top: 0;">📋 Thông tin đơn hàng</h2>
                            <p><strong>Mã đơn hàng:</strong> <span style="color: #007bff; font-weight: bold;">${order._id}</span></p>
                            <p><strong>Khách hàng:</strong> ${customerName} (${customerEmail})</p>
                            <p><strong>Phí vận chuyển:</strong> ${(order.shippingFee || 0).toLocaleString('vi-VN')} VNĐ</p>
                            <p><strong>Tổng tiền:</strong> <span style="color: #dc3545; font-weight: bold; font-size: 18px;">${order.totalPrice.toLocaleString('vi-VN')} VNĐ</span></p>
                            <p><strong>Thời gian:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🚚 Thông tin giao hàng</h3>
                            <p><strong>Họ tên:</strong> ${order.shippingInfo?.name}</p>
                            <p><strong>Điện thoại:</strong> ${order.shippingInfo?.phone}</p>
                            <p><strong>Email:</strong> ${order.shippingInfo?.email}</p>
                            <p><strong>Địa chỉ:</strong> ${order.shippingInfo?.address}</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">💳 Thông tin thanh toán</h3>
                            <p><strong>Phương thức:</strong> ${getPaymentMethodDisplay(order.paymentMethod)}</p>
                            <p><strong>Trạng thái:</strong> <span style="color: #ffc107; font-weight: bold;">${getPaymentStatusDisplay(order.paymentStatus)}</span></p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🛍️ Chi tiết sản phẩm</h3>
                            <div style="margin-bottom: 10px;">
                                ${order.items.map(item => `
                                    <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                                        <p style="margin: 5px 0;"><strong>${item.title}</strong></p>
                                        <p style="margin: 5px 0; color: #666;">Số lượng: ${item.quantity} | Giá: ${item.price.toLocaleString('vi-VN')} VNĐ</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3 style="color: #856404; margin-top: 0;">⚡ Hành động cần thiết</h3>
                            <p style="font-size: 16px; color: #856404;">Vui lòng xử lý đơn hàng này sớm nhất!</p>
                            <p style="color: #666; margin: 10px 0;">Truy cập admin panel để cập nhật trạng thái</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #666; margin: 0;">Trân trọng,<br><strong>Pet Store Admin</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Email này được gửi tự động từ hệ thống</p>
                        </div>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email thông báo đơn hàng admin đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email thông báo admin:', error);
        return false;
    }
};

// Gửi email thông báo đổi mật khẩu
const sendPasswordChangeNotification = async (user, newPassword) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: '🔐 Mật khẩu đã được thay đổi - Pet Store',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #007bff; margin: 0;">🔐 Mật khẩu đã được thay đổi</h1>
                            <p style="color: #666; margin: 10px 0;">Thông báo từ hệ thống Pet Store</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #333; margin-top: 0;">👋 Xin chào ${user.name}!</h2>
                            <p>Mật khẩu tài khoản của bạn đã được thay đổi bởi quản trị viên.</p>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">🔑 Thông tin mật khẩu mới</h3>
                            ${newPassword ? `<p><strong>Mật khẩu mới:</strong> <span style="color: #007bff; font-weight: bold; font-family: monospace;">${newPassword}</span></p>` : ''}
                            <p><strong>Thời gian thay đổi:</strong> ${new Date().toLocaleString('vi-VN')}</p>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #856404; margin-top: 0;">⚠️ Lưu ý bảo mật</h3>
                            <ul style="color: #856404;">
                                <li>Vui lòng đổi mật khẩu ngay sau khi đăng nhập</li>
                                <li>Không chia sẻ mật khẩu với người khác</li>
                                <li>Sử dụng mật khẩu mạnh để bảo vệ tài khoản</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #666; margin: 0;">Trân trọng,<br><strong>Pet Store</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                        </div>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email thông báo thay đổi mật khẩu đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email thông báo thay đổi mật khẩu:', error);
        return false;
    }
};

// Gửi email chào mừng
const sendWelcomeEmail = async (user) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: '🎉 Chào mừng bạn đến với Pet Store!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #28a745; margin: 0;">🎉 Chào mừng bạn!</h1>
                            <p style="color: #666; margin: 10px 0;">Cảm ơn bạn đã tham gia cộng đồng Pet Store</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #333; margin-top: 0;">👋 Xin chào ${user.name}!</h2>
                            <p>Chúng tôi rất vui mừng chào đón bạn đến với Pet Store - nơi yêu thương và chăm sóc tốt nhất cho những người bạn bốn chân của bạn.</p>
                        </div>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #28a745; margin-top: 0;">🐾 Tại sao chọn Pet Store?</h3>
                            <ul style="color: #28a745;">
                                <li>✅ Sản phẩm chất lượng cao</li>
                                <li>🚚 Giao hàng nhanh chóng</li>
                                <li>💰 Giá cả hợp lý</li>
                                <li>🎁 Nhiều ưu đãi hấp dẫn</li>
                                <li>📞 Hỗ trợ 24/7</li>
                            </ul>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #007bff; margin-top: 0;">🎁 Ưu đãi đặc biệt cho bạn</h3>
                            <p>Nhân dịp chào mừng bạn, chúng tôi tặng bạn:</p>
                            <ul style="color: #007bff;">
                                <li>🎯 Giảm 10% cho đơn hàng đầu tiên</li>
                                <li>🎁 Miễn phí vận chuyển cho đơn hàng trên 500k</li>
                                <li>📧 Nhận thông báo ưu đãi mới nhất</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <a href="${process.env.APP_URL}/products" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px;">🛍️ Mua sắm ngay</a>
                            <p style="color: #666; margin: 10px 0;">Trân trọng,<br><strong>Pet Store</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                        </div>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email chào mừng đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email chào mừng:', error);
        return false;
    }
};

// Gửi email thông báo reset mật khẩu
const sendPasswordResetNotification = async (user, newPassword) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: '🔐 Mật khẩu mới - Pet Store',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #dc3545; margin: 0;">🔐 Mật khẩu mới</h1>
                            <p style="color: #666; margin: 10px 0;">Mật khẩu tài khoản của bạn đã được reset</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h2 style="color: #333; margin-top: 0;">👋 Xin chào ${user.name}!</h2>
                            <p>Mật khẩu tài khoản của bạn đã được reset bởi quản trị viên.</p>
                        </div>
                        
                        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #721c24; margin-top: 0;">🔑 Thông tin đăng nhập mới</h3>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Mật khẩu mới:</strong> <span style="color: #dc3545; font-weight: bold; font-family: monospace;">${newPassword}</span></p>
                            <p><strong>Thời gian reset:</strong> ${new Date().toLocaleString('vi-VN')}</p>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #856404; margin-top: 0;">⚠️ Hướng dẫn bảo mật</h3>
                            <ol style="color: #856404;">
                                <li>Đăng nhập ngay với mật khẩu mới</li>
                                <li>Thay đổi mật khẩu trong phần cài đặt tài khoản</li>
                                <li>Không chia sẻ thông tin đăng nhập</li>
                                <li>Báo cáo ngay nếu có hoạt động bất thường</li>
                            </ol>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <a href="${process.env.APP_URL}/login" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px;">🔐 Đăng nhập ngay</a>
                            <p style="color: #666; margin: 10px 0;">Trân trọng,<br><strong>Pet Store</strong></p>
                            <p style="color: #999; font-size: 12px; margin: 10px 0;">Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                        </div>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email thông báo reset mật khẩu đã gửi:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email thông báo reset mật khẩu:', error);
        return false;
    }
};

// Gửi email xác nhận đăng ký
const sendSignupConfirmation = async function(user) {
    const subject = '🎉 Chào mừng bạn đến với Pet Store - Tài khoản đã được tạo thành công!';
    
    // Tạo mật khẩu tạm thời nếu user được tạo bởi admin
    const tempPassword = user.tempPassword || 'Mật khẩu bạn đã nhập khi đăng ký';
    const isAdminCreated = user.tempPassword ? true : false;
    
    const html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Chào mừng đến với Pet Store</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f8f9fa;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 30px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }
                .header p {
                    margin: 10px 0 0 0;
                    font-size: 16px;
                    opacity: 0.9;
                }
                .content {
                    padding: 40px 30px;
                }
                .welcome-section {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .welcome-section h2 {
                    color: #2c3e50;
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .welcome-section p {
                    color: #7f8c8d;
                    font-size: 16px;
                    margin: 0;
                }
                .account-info {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 25px;
                    margin: 25px 0;
                    border-left: 4px solid #3498db;
                }
                .account-info h3 {
                    color: #2c3e50;
                    margin-top: 0;
                    font-size: 18px;
                    margin-bottom: 15px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #ecf0f1;
                }
                .info-row:last-child {
                    border-bottom: none;
                }
                .info-label {
                    font-weight: 600;
                    color: #34495e;
                }
                .info-value {
                    color: #2c3e50;
                    font-weight: 500;
                }
                .password-section {
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 25px 0;
                }
                .password-section h4 {
                    color: #856404;
                    margin-top: 0;
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                .password-section p {
                    color: #856404;
                    margin: 0;
                    font-size: 14px;
                }
                .features-section {
                    margin: 30px 0;
                }
                .features-section h3 {
                    color: #2c3e50;
                    font-size: 18px;
                    margin-bottom: 15px;
                }
                .feature-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .feature-list li {
                    padding: 8px 0;
                    color: #7f8c8d;
                    position: relative;
                    padding-left: 25px;
                }
                .feature-list li:before {
                    content: "✓";
                    position: absolute;
                    left: 0;
                    color: #27ae60;
                    font-weight: bold;
                }
                .cta-section {
                    text-align: center;
                    margin: 30px 0;
                }
                .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 25px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: all 0.3s ease;
                }
                .cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                .footer {
                    background-color: #f8f9fa;
                    padding: 25px 30px;
                    text-align: center;
                    border-top: 1px solid #ecf0f1;
                }
                .footer p {
                    margin: 0;
                    color: #7f8c8d;
                    font-size: 14px;
                }
                .social-links {
                    margin-top: 15px;
                }
                .social-links a {
                    color: #3498db;
                    text-decoration: none;
                    margin: 0 10px;
                    font-weight: 500;
                }
                .warning-box {
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px 0;
                }
                .warning-box h4 {
                    color: #721c24;
                    margin-top: 0;
                    font-size: 16px;
                    margin-bottom: 8px;
                }
                .warning-box p {
                    color: #721c24;
                    margin: 0;
                    font-size: 14px;
                }
                @media (max-width: 600px) {
                    .container {
                        margin: 10px;
                        border-radius: 8px;
                    }
                    .header, .content, .footer {
                        padding: 20px;
                    }
                    .header h1 {
                        font-size: 24px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Chào mừng đến với Pet Store!</h1>
                    <p>Tài khoản của bạn đã được tạo thành công</p>
                </div>
                
                <div class="content">
                    <div class="welcome-section">
                        <h2>Xin chào ${user.name}! 👋</h2>
                        <p>Cảm ơn bạn đã chọn Pet Store làm nơi mua sắm cho thú cưng yêu quý</p>
                    </div>
                    
                    <div class="account-info">
                        <h3>📋 Thông tin tài khoản</h3>
                        <div class="info-row">
                            <span class="info-label">Họ tên:</span>
                            <span class="info-value">${user.name}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${user.email}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Ngày tạo:</span>
                            <span class="info-value">${new Date().toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Vai trò:</span>
                            <span class="info-value">${user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</span>
                        </div>
                    </div>
                    
                    ${isAdminCreated ? `
                        <div class="password-section">
                            <h4>🔐 Thông tin đăng nhập</h4>
                            <p><strong>Mật khẩu tạm thời:</strong> ${tempPassword}</p>
                            <p><em>Vui lòng đổi mật khẩu sau khi đăng nhập lầu đầu để bảo mật tài khoản.</em></p>
                        </div>
                    ` : `
                        <div class="password-section">
                            <h4>🔐 Thông tin đăng nhập</h4>
                            <p><strong>Mật khẩu:</strong> ${tempPassword}</p>
                            <p><em>Hãy giữ mật khẩu an toàn và không chia sẻ với người khác.</em></p>
                        </div>
                    `}
                    
                    <div class="features-section">
                        <h3>✨ Những gì bạn có thể làm</h3>
                        <ul class="feature-list">
                            <li>Mua sắm sản phẩm chất lượng cho thú cưng</li>
                            <li>Đặt hàng online với giao hàng tận nơi</li>
                            <li>Thanh toán an toàn với nhiều phương thức</li>
                            <li>Theo dõi đơn hàng trực tuyến</li>
                            <li>Nhận thông báo về đơn hàng qua email</li>
                            <li>Tích lũy điểm thưởng khi mua sắm</li>
                        </ul>
                    </div>
                    
                    <div class="cta-section">
                        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" class="cta-button">
                            🚀 Bắt đầu mua sắm ngay
                        </a>
                    </div>
                    
                    ${isAdminCreated ? `
                        <div class="warning-box">
                            <h4>⚠️ Lưu ý quan trọng</h4>
                            <p>Tài khoản này được tạo bởi quản trị viên. Vui lòng đổi mật khẩu ngay sau khi đăng nhập lầu đầu để đảm bảo an toàn.</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Pet Store. Tất cả quyền được bảo lưu.</p>
                    <p>Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                    <div class="social-links">
                        <a href="#">Facebook</a> | 
                        <a href="#">Instagram</a> | 
                        <a href="#">Zalo</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendMail(user.email, subject, html);
};

// Gửi email thông báo thay đổi trạng thái đơn hàng
const sendOrderStatusUpdate = async (order, user, oldStatus, newStatus) => {
    try {
        const customerEmail = order.shippingInfo?.email || user.email;
        const customerName = order.shippingInfo?.name || user.name;
        
        // Xác định nội dung email dựa trên thay đổi trạng thái
        let subject = '';
        let message = '';
        
        switch (newStatus) {
            case 'confirmed':
                if (oldStatus === 'pending') {
                    subject = 'Đơn hàng của bạn đang được xác nhận - Pet Store';
                    message = 'Đơn hàng của bạn đang được xác nhận.';
                }
                break;
            case 'shipping':
                if (oldStatus === 'confirmed') {
                    subject = 'Đơn hàng của bạn đang được giao - Pet Store';
                    message = 'Đơn hàng của bạn đang được giao.';
                }
                break;
            case 'delivered': // Thêm xử lý trạng thái hoàn tất giao hàng
                subject = 'Đơn hàng của bạn đã được giao thành công - Pet Store';
                message = 'Đơn hàng của bạn đã được giao thành công.';
                break;
            case 'cancelled':
                subject = 'Đơn hàng của bạn đã bị hủy - Pet Store';
                message = 'Đơn hàng của bạn đã bị hủy.';
                break;
            default:
                return false; // Không gửi email cho các trạng thái khác
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: subject,
            html: `
                <h1>Xin chào ${customerName}!</h1>
                <p>${message}</p>
                <h2>Thông tin đơn hàng:</h2>
                <p>Mã đơn hàng: ${order._id}</p>
                <p>Trạng thái mới: ${getOrderStatusDisplay(newStatus)}</p>
                <p>Thời gian cập nhật: ${new Date().toLocaleString('vi-VN')}</p>
                <h3>Chi tiết đơn hàng:</h3>
                <ul>
                    ${order.items.map(item => `
                        <li>
                            ${item.title} - Số lượng: ${item.quantity} - 
                            Giá: ${item.price.toLocaleString('vi-VN')} VNĐ
                        </li>
                    `).join('')}
                </ul>
                <p>Tổng tiền: ${order.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                <p>Trân trọng,<br>Pet Store</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email thông báo thay đổi trạng thái đơn hàng đã gửi: ${oldStatus} → ${newStatus}`, info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái:', error);
        return false;
    }
};

// Gửi email thông báo thay đổi trạng thái thanh toán
const sendPaymentStatusUpdate = async (order, user, oldPaymentStatus, newPaymentStatus) => {
    try {
        const customerEmail = order.shippingInfo?.email || user.email;
        const customerName = order.shippingInfo?.name || user.name;
        
        // Xác định nội dung email dựa trên thay đổi trạng thái thanh toán
        let subject = '';
        let message = '';
        
        switch (newPaymentStatus) {
            case 'paid':
                if (oldPaymentStatus === 'pending' || oldPaymentStatus === 'awaiting') {
                    subject = 'Bạn đã thanh toán thành công - Pet Store';
                    message = 'Bạn đã thanh toán thành công.';
                }
                break;
            case 'failed':
                subject = 'Thanh toán không thành công - Pet Store';
                message = 'Thanh toán không thành công. Vui lòng thử lại.';
                break;
            default:
                return false; // Không gửi email cho các trạng thái khác
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: subject,
            html: `
                <h1>Xin chào ${customerName}!</h1>
                <p>${message}</p>
                <h2>Thông tin đơn hàng:</h2>
                <p>Mã đơn hàng: ${order._id}</p>
                <p>Trạng thái thanh toán mới: ${getPaymentStatusDisplay(newPaymentStatus)}</p>
                <p>Thời gian cập nhật: ${new Date().toLocaleString('vi-VN')}</p>
                <h3>Chi tiết đơn hàng:</h3>
                <ul>
                    ${order.items.map(item => `
                        <li>
                            ${item.title} - Số lượng: ${item.quantity} - 
                            Giá: ${item.price.toLocaleString('vi-VN')} VNĐ
                        </li>
                    `).join('')}
                </ul>
                <p>Tổng tiền: ${order.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                <p>Trân trọng,<br>Pet Store</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email thông báo thay đổi trạng thái thanh toán đã gửi: ${oldPaymentStatus} → ${newPaymentStatus}`, info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi gửi email thông báo thay đổi trạng thái thanh toán:', error);
        return false;
    }
};

// Helper để hiển thị trạng thái đơn hàng
function getOrderStatusDisplay(status) {
    const statuses = {
        'pending': 'Chờ xác nhận',
        'confirmed': 'Đang xác nhận',
        'shipping': 'Đang giao',
        'delivered': 'Đã giao', // Bổ sung trạng thái này
        'completed': 'Đã giao',
        'cancelled': 'Đã hủy'
    };
    return statuses[status] || 'Không xác định';
}

// Hàm gửi email đơn giản
const sendEmail = async (to, subject, html) => {
  return sendMail(to, subject, html);
};

// Gửi email xác nhận booking
const sendBookingApproved = async (user, service, booking) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px;">
        <h2 style="color: #28a745;">Đặt lịch dịch vụ đã được xác nhận!</h2>
        <p>Xin chào <b>${user.name}</b>,</p>
        <p>Đặt lịch dịch vụ <b>${service.name}</b> của bạn đã được xác nhận.</p>
        <ul>
          <li><b>Ngày:</b> ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('vi-VN') : ''}</li>
          <li><b>Giờ:</b> ${booking.timeSlot?.start && booking.timeSlot?.end ? booking.timeSlot.start + ' - ' + booking.timeSlot.end : ''}</li>
          <li><b>Thú cưng:</b> ${booking.customerInfo?.petInfo?.name || ''} (${booking.customerInfo?.petInfo?.type || ''})</li>
          <li><b>Ghi chú:</b> ${booking.notes || ''}</li>
        </ul>
        <p>Cảm ơn bạn đã sử dụng dịch vụ!</p>
      </div>
    </div>
  `;
  return sendMail(user.email, 'Đặt lịch dịch vụ đã được xác nhận', html);
};

// Gửi email thông báo đơn hàng bị từ chối
const sendBookingRejected = async (user, service, booking) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px;">
        <h2 style="color: #dc3545;">Rất tiếc, đặt lịch dịch vụ của bạn đã bị từ chối</h2>
        <p>Xin chào <b>${user.name}</b>,</p>
        <p>Chúng tôi xin lỗi vì không thể xác nhận đặt lịch dịch vụ <b>${service.name}</b> của bạn.</p>
        <ul>
          <li><b>Ngày:</b> ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('vi-VN') : ''}</li>
          <li><b>Giờ:</b> ${booking.timeSlot?.start && booking.timeSlot?.end ? booking.timeSlot.start + ' - ' + booking.timeSlot.end : ''}</li>
          <li><b>Thú cưng:</b> ${booking.customerInfo?.petInfo?.name || ''} (${booking.customerInfo?.petInfo?.type || ''})</li>
          <li><b>Ghi chú:</b> ${booking.notes || ''}</li>
        </ul>
        <p>Nếu cần hỗ trợ thêm, vui lòng liên hệ với chúng tôi.</p>
        <p>Trân trọng cảm ơn!</p>
      </div>
    </div>
  `;
  return sendMail(user.email, 'Đặt lịch dịch vụ bị từ chối', html);
};

// Xuất module
module.exports = {
    sendOrderConfirmation,
    sendNewPassword,
    sendNewOrderNotification,
    sendPasswordChangeNotification,
    sendSignupConfirmation,
    sendOrderStatusUpdate,
    sendPaymentStatusUpdate,
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetNotification,
    sendBookingApproved,
    sendBookingRejected
};
