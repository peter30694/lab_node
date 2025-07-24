const bcrypt = require('bcryptjs');
const config = require('../config');

class PasswordUtils {
    /**
     * Mã hóa mật khẩu
     * @param {string} password - Mật khẩu gốc
     * @returns {Promise<string>} - Mật khẩu đã mã hóa
     */
    static async hashPassword(password) {
        try {
            if (!password || typeof password !== 'string') {
                throw new Error('Mật khẩu không hợp lệ');
            }

            // Kiểm tra độ dài mật khẩu
            if (password.length < config.security.passwordMinLength) {
                throw new Error(`Mật khẩu phải có ít nhất ${config.security.passwordMinLength} ký tự`);
            }

            // Mã hóa mật khẩu với salt rounds
            const saltRounds = config.security.bcryptRounds;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            console.log('✅ Mật khẩu đã được mã hóa thành công');
            return hashedPassword;
        } catch (error) {
            console.error('❌ Lỗi khi mã hóa mật khẩu:', error);
            throw error;
        }
    }

    /**
     * So sánh mật khẩu với hash
     * @param {string} password - Mật khẩu gốc
     * @param {string} hashedPassword - Mật khẩu đã mã hóa
     * @returns {Promise<boolean>} - True nếu khớp, False nếu không khớp
     */
    static async comparePassword(password, hashedPassword) {
        try {
            if (!password || !hashedPassword) {
                return false;
            }

            const isMatch = await bcrypt.compare(password, hashedPassword);
            return isMatch;
        } catch (error) {
            console.error('❌ Lỗi khi so sánh mật khẩu:', error);
            return false;
        }
    }

    /**
     * Kiểm tra độ mạnh của mật khẩu
     * @param {string} password - Mật khẩu cần kiểm tra
     * @returns {object} - Kết quả kiểm tra
     */
    static validatePasswordStrength(password) {
        const result = {
            isValid: true,
            errors: [],
            score: 0
        };

        // Kiểm tra độ dài (tối thiểu 6 ký tự)
        if (password.length < config.security.passwordMinLength) {
            result.isValid = false;
            result.errors.push(`Mật khẩu phải có ít nhất ${config.security.passwordMinLength} ký tự`);
        } else {
            result.score += 1;
        }

        // Kiểm tra có chữ hoa (không bắt buộc cho mật khẩu 6 ký tự)
        if (/[A-Z]/.test(password)) {
            result.score += 1;
        }

        // Kiểm tra có chữ thường (không bắt buộc cho mật khẩu 6 ký tự)
        if (/[a-z]/.test(password)) {
            result.score += 1;
        }

        // Kiểm tra có số
        if (/\d/.test(password)) {
            result.score += 1;
        } else {
            result.errors.push('Mật khẩu phải chứa ít nhất 1 số');
            result.isValid = false;
        }

        // Kiểm tra có ký tự đặc biệt (không bắt buộc cho mật khẩu 6 ký tự)
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            result.score += 1;
        }

        // Nếu có lỗi thì không hợp lệ
        if (result.errors.length > 0) {
            result.isValid = false;
        }

        return result;
    }

    /**
     * Tạo mật khẩu ngẫu nhiên (6 số cho reset password)
     * @param {number} length - Độ dài mật khẩu (mặc định 6)
     * @returns {string} - Mật khẩu ngẫu nhiên
     */
    static generateRandomPassword(length = 6) {
        // Tạo mật khẩu 6 số cho reset password
        if (length === 6) {
            return Math.floor(100000 + Math.random() * 900000).toString();
        }

        // Tạo mật khẩu phức tạp cho các trường hợp khác
        const charset = {
            lowercase: 'abcdefghijklmnopqrstuvwxyz',
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };

        let password = '';
        
        // Đảm bảo có ít nhất 1 ký tự từ mỗi loại
        password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
        password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
        password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
        password += charset.symbols[Math.floor(Math.random() * charset.symbols.length)];

        // Thêm các ký tự ngẫu nhiên để đủ độ dài
        const allChars = charset.lowercase + charset.uppercase + charset.numbers + charset.symbols;
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Xáo trộn mật khẩu
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Kiểm tra mật khẩu có phải là mật khẩu yếu không
     * @param {string} password - Mật khẩu cần kiểm tra
     * @returns {boolean} - True nếu là mật khẩu yếu
     */
    static isWeakPassword(password) {
        console.log('=== [PASSWORD] Checking if password is weak:', password);
        
        const weakPasswords = [
            'password', '12345678', 'qwerty', 'abc123',
            'password123', 'admin', 'letmein', 'welcome', 'monkey',
            'dragon', 'master', 'hello', 'freedom', 'whatever',
            'qazwsx', 'trustno1', 'jordan', 'harley', 'ranger',
            'iwantu', 'jennifer', 'joshua', 'maggie', 'hunter',
            'summer', 'corvette', 'chelsea', 'black', 'diamond',
            'nascar', 'jackson', 'cameron', '654321', 'computer',
            'amanda', 'wizard', 'xxxxxxxx', 'money1', 'phoenix',
            'mickey', 'bailey', 'knight', 'iceman', 'tigers',
            'purple', 'andrea', 'horny', 'dakota', 'aaaaaa',
            'player', 'sunshine', 'morgan', 'starwars', 'boomer',
            'cowboys', 'edward', 'charles', 'girls', 'coffee',
            'bulldog', 'ncc1701', 'rabbit', 'peanut', 'johnson',
            'chester', 'london', 'midnight', 'blue', 'fishing',
            '000000', 'orange', 'redbird', 'manchester', 'gandalf',
            'cooper', '1313', 'scorpio', 'mountain', 'madison',
            '987654', 'braves', 'gators', 'heaven', 'gordon',
            'casper', 'stupid', 'saturn', 'gemini', 'apples',
            'august', 'canada', 'blazer', 'cumming', 'hunting',
            'kitty', 'rainbow', 'arthur', 'cream', 'calvin',
            'shaved', 'surfer', 'samson', 'kelly', 'paul'
        ];

        const lowerPassword = password.toLowerCase();
        const isWeak = weakPasswords.includes(lowerPassword);
        console.log('=== [PASSWORD] Password is weak:', isWeak);
        return isWeak;
    }

    /**
     * Kiểm tra mật khẩu có chứa thông tin cá nhân không
     * @param {string} password - Mật khẩu cần kiểm tra
     * @param {object} userInfo - Thông tin người dùng
     * @returns {boolean} - True nếu chứa thông tin cá nhân
     */
    static containsPersonalInfo(password, userInfo) {
        const personalInfo = [
            userInfo.name,
            userInfo.email,
            userInfo.email?.split('@')[0],
            userInfo.phone,
            new Date().getFullYear().toString(),
            (new Date().getFullYear() - 1).toString(),
            (new Date().getFullYear() - 2).toString()
        ].filter(Boolean);

        const lowerPassword = password.toLowerCase();
        return personalInfo.some(info => 
            lowerPassword.includes(info.toLowerCase())
        );
    }
}

module.exports = PasswordUtils; 