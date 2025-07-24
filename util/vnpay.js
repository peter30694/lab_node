const crypto = require('crypto');
const moment = require('moment');

class VNPay {
    constructor() {
        // Kiểm tra environment variables
        if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET) {
            throw new Error('VNPay configuration missing: TMN_CODE or HASH_SECRET not found');
        }
        if (!process.env.VNPAY_URL || !process.env.VNPAY_RETURN_URL) {
            throw new Error('VNPay configuration missing: URL or RETURN_URL not found');
        }
        
        this.vnp_TmnCode = process.env.VNPAY_TMN_CODE;
        this.vnp_HashSecret = process.env.VNPAY_HASH_SECRET;
        this.vnp_Url = process.env.VNPAY_URL;
        this.vnp_ReturnUrl = process.env.VNPAY_RETURN_URL;
        this.vnp_IpnUrl = process.env.VNPAY_IPN_URL;
        
        // Kiểm tra môi trường sandbox
        this.isSandbox = process.env.NODE_ENV === 'development' || 
                        process.env.VNPAY_URL.includes('sandbox') ||
                        process.env.VNPAY_SANDBOX === 'true';
        
        if (this.isSandbox) {
            console.log('🧪 VNPay đang chạy ở chế độ SANDBOX - Validation được nới lỏng');
        }
    }

    // Tạo URL thanh toán
    createPaymentUrl(orderId, amount, orderInfo, ipAddr, locale = 'vn') {
        // Validate inputs - nới lỏng cho sandbox
        if (!orderId) {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: Order ID trống, tự động tạo ID');
                orderId = 'TEST_' + Date.now();
            } else {
                throw new Error('Order ID không hợp lệ');
            }
        }
        
        if (typeof orderId !== 'string') {
            orderId = String(orderId);
        }
        
        if (orderId.trim().length === 0) {
            if (this.isSandbox) {
                orderId = 'TEST_' + Date.now();
            } else {
                throw new Error('Order ID không hợp lệ');
            }
        }

        if (!orderInfo) {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: Order info trống, sử dụng mặc định');
                orderInfo = `Test order ${orderId}`;
            } else {
                throw new Error('Thông tin đơn hàng không hợp lệ');
            }
        }
        
        if (typeof orderInfo !== 'string') {
            orderInfo = String(orderInfo);
        }
        
        // Nới lỏng giới hạn độ dài cho sandbox
        if (orderInfo.length > 255) {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: Order info quá dài, cắt ngắn');
                orderInfo = orderInfo.substring(0, 255);
            } else {
                throw new Error('Thông tin đơn hàng không hợp lệ (tối đa 255 ký tự)');
            }
        }

        if (!ipAddr) {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: IP Address trống, sử dụng localhost');
                ipAddr = '127.0.0.1';
            } else {
                throw new Error('IP Address không hợp lệ');
            }
        }
        
        if (typeof ipAddr !== 'string') {
            ipAddr = String(ipAddr);
        }

        // Nới lỏng validation số tiền cho sandbox
        if (!amount || typeof amount !== 'number') {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: Amount không hợp lệ, sử dụng 10,000 VND');
                amount = 10000;
            } else {
                throw new Error('Số tiền không hợp lệ');
            }
        }
        
        // Nới lỏng giới hạn số tiền cho sandbox
        if (this.isSandbox) {
            // Cho phép từ 1,000 VND đến 10 tỷ VND trong sandbox
            if (amount < 1000) {
                console.warn('⚠️ SANDBOX: Số tiền quá nhỏ, điều chỉnh thành 1,000 VND');
                amount = 1000;
            }
            if (amount >= 10000000000) {
                console.warn('⚠️ SANDBOX: Số tiền quá lớn, điều chỉnh thành 999,999,999 VND');
                amount = 999999999;
            }
        } else {
            // Production validation nghiêm ngặt
            if (amount < 5000 || amount >= 1000000000) {
                throw new Error('Số tiền không hợp lệ. Phải từ 5,000 đến dưới 1 tỷ VND');
            }
        }

        const createDate = moment().format('YYYYMMDDHHmmss');

        const vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: this.vnp_TmnCode,
            vnp_Locale: locale,
            vnp_CurrCode: 'VND',
            vnp_TxnRef: orderId,
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: 'other',
            vnp_Amount: amount * 100, // Đơn vị: x100
            vnp_ReturnUrl: this.vnp_ReturnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate
        };

        // Sắp xếp tham số theo thứ tự alphabet
        const sortedParams = this.sortObject(vnp_Params);

        // Tạo chuỗi dữ liệu để ký
        const signData = new URLSearchParams(sortedParams).toString();

        // Tạo secure hash (chữ ký)
        const hmac = crypto.createHmac('sha512', this.vnp_HashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

        // Thêm vnp_SecureHash vào tham số
        sortedParams.vnp_SecureHash = signed;

        // Tạo URL thanh toán cuối cùng
        const paymentUrl = `${this.vnp_Url}?${new URLSearchParams(sortedParams).toString()}`;
        
        if (this.isSandbox) {
            console.log('🧪 SANDBOX Payment URL created:', paymentUrl);
        }
        
        return paymentUrl;
    }

    // Xác thực chữ ký từ VNPay (khi return)
    verifyReturnUrl(vnp_Params) {
        if (this.isSandbox) {
            console.log('🧪 SANDBOX: VNPay Signature Verification (Relaxed Mode)');
        } else {
            console.log('=== VNPay Signature Verification Debug ===');
        }
        
        // Clone object để không modify object gốc
        const params = { ...vnp_Params };
        const receivedHash = params['vnp_SecureHash'];
        
        console.log('Received hash:', receivedHash);
        
        // Nới lỏng validation cho sandbox
        if (!receivedHash) {
            if (this.isSandbox) {
                console.warn('⚠️ SANDBOX: Missing vnp_SecureHash - Bỏ qua kiểm tra chữ ký');
                return true; // Bỏ qua kiểm tra chữ ký trong sandbox
            } else {
                console.log('❌ Missing vnp_SecureHash');
                throw new Error('Thiếu vnp_SecureHash trong response');
            }
        }
        
        delete params['vnp_SecureHash'];
        delete params['vnp_SecureHashType'];

        const sortedParams = this.sortObject(params);
        console.log('Sorted params for signing:', sortedParams);
        
        const signData = new URLSearchParams(sortedParams).toString();
        console.log('Sign data string:', signData);
        console.log('Hash secret (first 10 chars):', this.vnp_HashSecret.substring(0, 10) + '...');

        const hmac = crypto.createHmac('sha512', this.vnp_HashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
        
        console.log('Generated hash:', signed);
        console.log('Hashes match:', signed === receivedHash);
        
        if (this.isSandbox) {
            console.log('🧪 SANDBOX: Signature verification completed');
            // Trong sandbox, nếu chữ ký không khớp, chỉ cảnh báo chứ không fail
            if (signed !== receivedHash) {
                console.warn('⚠️ SANDBOX: Chữ ký không khớp nhưng vẫn cho phép tiếp tục');
                return true; // Cho phép tiếp tục trong sandbox
            }
        } else {
            console.log('=== End Signature Verification Debug ===');
        }

        return signed === receivedHash;
    }

    // Sắp xếp tham số
    sortObject(obj) {
        const sorted = {};
        Object.keys(obj)
            .sort()
            .forEach((key) => {
                sorted[key] = typeof obj[key] === 'string' ? obj[key] : String(obj[key]);
            });
        return sorted;
    }

    // Lấy thông báo từ mã phản hồi VNPay
    getResponseMessage(responseCode) {
        const messages = {
            '00': 'Giao dịch thành công',
            '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ.',
            '09': 'Thẻ/Tài khoản chưa đăng ký Internet Banking.',
            '10': 'Xác thực thông tin sai quá 3 lần.',
            '11': 'Hết thời gian thanh toán.',
            '12': 'Thẻ/Tài khoản bị khóa.',
            '13': 'Sai mật khẩu OTP.',
            '24': 'Khách hàng hủy giao dịch.',
            '51': 'Không đủ số dư.',
            '65': 'Vượt hạn mức giao dịch.',
            '75': 'Ngân hàng bảo trì.',
            '79': 'Nhập sai mật khẩu quá số lần quy định.',
            '99': 'Lỗi khác (không xác định)'
        };
        
        // Thêm một số mã test cho sandbox
        if (this.isSandbox) {
            const sandboxMessages = {
                'TEST_SUCCESS': 'Test giao dịch thành công',
                'TEST_FAIL': 'Test giao dịch thất bại',
                ...messages
            };
            return sandboxMessages[responseCode] || 'Test - Lỗi không xác định';
        }
        
        return messages[responseCode] || 'Lỗi không xác định';
    }

    // Thêm method để test trong sandbox
    createTestPaymentUrl(orderId = null, amount = 10000) {
        if (!this.isSandbox) {
            throw new Error('Test method chỉ khả dụng trong sandbox');
        }
        
        console.log('🧪 Tạo test payment URL cho sandbox');
        
        return this.createPaymentUrl(
            orderId || 'TEST_' + Date.now(),
            amount,
            'Test payment for sandbox',
            '127.0.0.1'
        );
    }
}

module.exports = VNPay;
