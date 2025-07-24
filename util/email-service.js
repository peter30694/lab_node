const nodemailer = require('nodemailer');
const { logger } = require('./logger');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Base email template
    getBaseTemplate(content, title, subtitle = '') {
        return `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
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
                        <h1>${title}</h1>
                        ${subtitle ? `<p>${subtitle}</p>` : ''}
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Pet Store. Tất cả quyền được bảo lưu.</p>
                        <p>Nếu có thắc mắc, vui lòng liên hệ: support@petstore.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Contact form email template
    getContactEmailTemplate(data) {
        const content = `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #2f80ed; margin: 0 0 12px 0; font-size: 20px;">Thông tin liên hệ</h3>
                <div style="background: #f1f5f9; border-radius: 8px; padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0;"><strong>👤 Họ tên:</strong> <span style="color: #222;">${data.name}</span></p>
                    <p style="margin: 0 0 8px 0;"><strong>✉️ Email:</strong> <a href="mailto:${data.email}" style="color: #2f80ed; text-decoration: underline;">${data.email}</a></p>
                    ${data.phone ? `<p style="margin: 0 0 8px 0;"><strong>📞 Điện thoại:</strong> <span style="color: #222;">${data.phone}</span></p>` : ''}
                    <p style="margin: 0 0 8px 0;"><strong>🏷️ Chủ đề:</strong> <span style="color: #222;">${data.subject}</span></p>
                </div>
            </div>
            <div>
                <h3 style="color: #2f80ed; margin: 0 0 12px 0; font-size: 20px;">Nội dung liên hệ</h3>
                <div style="background: #f9fafb; border-radius: 8px; padding: 18px 20px; color: #333; font-size: 16px; line-height: 1.7;">
                    ${data.message.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;

        return {
            subject: `[PetShop Contact] ${data.subject}`,
            html: this.getBaseTemplate(content, '📩 Liên hệ mới từ website Pet Store', 'Bạn vừa nhận được một tin nhắn liên hệ mới')
        };
    }

    // Newsletter confirmation email template
    getNewsletterConfirmationTemplate(email) {
        const content = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px;">Chào mừng bạn!</h2>
                <p style="color: #7f8c8d; font-size: 16px; margin: 0;">Cảm ơn bạn đã đăng ký nhận tin tức từ Pet Store. Bạn sẽ nhận được những thông tin mới nhất về sản phẩm và dịch vụ của chúng tôi.</p>
            </div>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #27ae60;">
                <h3 style="color: #2c3e50; margin-top: 0; font-size: 18px; margin-bottom: 15px;">📧 Thông tin đăng ký</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <span style="font-weight: 600; color: #34495e;">Email:</span>
                    <span style="color: #2c3e50; font-weight: 500;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <span style="font-weight: 600; color: #34495e;">Ngày đăng ký:</span>
                    <span style="color: #2c3e50; font-weight: 500;">${new Date().toLocaleDateString('vi-VN')}</span>
                </div>
            </div>
            
            <div style="margin: 30px 0;">
                <h3 style="color: #2c3e50; font-size: 18px; margin-bottom: 15px;">🎁 Lợi ích khi đăng ký</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 8px 0; color: #7f8c8d; position: relative; padding-left: 25px;">
                        <span style="position: absolute; left: 0; color: #27ae60; font-weight: bold;">✓</span>
                        Nhận thông tin sản phẩm mới nhất
                    </li>
                    <li style="padding: 8px 0; color: #7f8c8d; position: relative; padding-left: 25px;">
                        <span style="position: absolute; left: 0; color: #27ae60; font-weight: bold;">✓</span>
                        Khuyến mãi đặc biệt dành riêng
                    </li>
                    <li style="padding: 8px 0; color: #7f8c8d; position: relative; padding-left: 25px;">
                        <span style="position: absolute; left: 0; color: #27ae60; font-weight: bold;">✓</span>
                        Tin tức chăm sóc thú cưng
                    </li>
                    <li style="padding: 8px 0; color: #7f8c8d; position: relative; padding-left: 25px;">
                        <span style="position: absolute; left: 0; color: #27ae60; font-weight: bold;">✓</span>
                        Hướng dẫn sử dụng sản phẩm
                    </li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 16px;">
                    Ghé thăm website
                </a>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/newsletter/unsubscribe?email=${encodeURIComponent(email)}" 
                   style="color: #e74c3c; text-decoration: none; font-size: 12px;">
                    Hủy đăng ký
                </a>
            </div>
        `;

        return {
            subject: '🎉 Đăng ký nhận tin tức thành công - Pet Store',
            html: this.getBaseTemplate(content, '🎉 Đăng ký thành công!', 'Cảm ơn bạn đã đăng ký nhận tin tức từ Pet Store')
        };
    }

    // Newsletter broadcast email template
    getNewsletterBroadcastTemplate(subject, content, unsubscribeEmail) {
        const emailContent = `
            <div style="margin-bottom: 30px;">
                <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 15px;">${subject}</h2>
                <div style="color: #333; font-size: 16px; line-height: 1.7;">
                    ${content.replace(/\n/g, '<br>')}
                </div>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/newsletter/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}" 
                   style="color: #e74c3c; text-decoration: none; font-size: 12px;">
                    Hủy đăng ký
                </a>
            </div>
        `;

        return {
            subject: subject,
            html: this.getBaseTemplate(emailContent, subject)
        };
    }

    // Send email with error handling
    async sendEmail(to, subject, html) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to,
                subject,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('📧 Email đã gửi thành công', { 
                messageId: info.messageId, 
                to: to,
                subject: subject 
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('❌ Lỗi khi gửi email', { 
                error: error.message, 
                to: to,
                subject: subject 
            });
            return { success: false, error: error.message };
        }
    }

    // Gửi email kèm file đính kèm
    async sendMailWithAttachment({ to, subject, text, html, attachments }) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to,
                subject,
                text,
                html,
                attachments
            };
            const info = await this.transporter.sendMail(mailOptions);
            logger.info('📧 Email đã gửi thành công (có file đính kèm)', { messageId: info.messageId, to, subject });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('❌ Lỗi khi gửi email (có file đính kèm)', { error: error.message, to, subject });
            return { success: false, error: error.message };
        }
    }

    // Send contact form email
    async sendContactEmail(contactData) {
        const emailData = this.getContactEmailTemplate(contactData);
        return await this.sendEmail(process.env.EMAIL_USER, emailData.subject, emailData.html);
    }

    // Send newsletter confirmation email
    async sendNewsletterConfirmation(email) {
        const emailData = this.getNewsletterConfirmationTemplate(email);
        return await this.sendEmail(email, emailData.subject, emailData.html);
    }

    // Send newsletter broadcast
    async sendNewsletterBroadcast(subscribers, subject, content) {
        const results = {
            total: subscribers.length,
            success: 0,
            error: 0,
            errors: []
        };

        for (const subscriber of subscribers) {
            const emailData = this.getNewsletterBroadcastTemplate(subject, content, subscriber.email);
            const result = await this.sendEmail(subscriber.email, emailData.subject, emailData.html);
            
            if (result.success) {
                results.success++;
            } else {
                results.error++;
                results.errors.push({
                    email: subscriber.email,
                    error: result.error
                });
            }
        }

        return results;
    }

    // Send contact reply email
    async sendContactReply(email, name, replyMessage) {
        const emailData = this.getContactReplyTemplate(name, replyMessage);
        return await this.sendEmail(email, emailData.subject, emailData.html);
    }

    // Contact reply email template
    getContactReplyTemplate(name, replyMessage) {
        const content = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px;">Xin chào ${name || 'Quý khách'}!</h2>
                <p style="color: #7f8c8d; font-size: 16px; margin: 0;">Cảm ơn bạn đã liên hệ với chúng tôi. Dưới đây là phản hồi của chúng tôi:</p>
            </div>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
                <h3 style="color: #2c3e50; margin-top: 0; font-size: 18px; margin-bottom: 15px;">📧 Phản hồi từ Pet Store</h3>
                <div style="color: #333; font-size: 16px; line-height: 1.7;">
                    ${replyMessage.replace(/\n/g, '<br>')}
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 16px;">
                    Ghé thăm website
                </a>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
                <p style="color: #7f8c8d; font-size: 14px;">Trân trọng,<br><strong>Đội ngũ Pet Store</strong></p>
            </div>
        `;

        return {
            subject: '📧 Phản hồi từ Pet Store',
            html: this.getBaseTemplate(content, '📧 Phản hồi từ Pet Store', 'Cảm ơn bạn đã liên hệ với chúng tôi')
        };
    }

    // Validate email format
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Test email service
    async testConnection() {
        try {
            await this.transporter.verify();
            logger.info('✅ Email service connection successful');
            return true;
        } catch (error) {
            logger.error('❌ Email service connection failed', { error: error.message });
            return false;
        }
    }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService; 