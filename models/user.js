const getDb = require('../util/database').getDb;
const mongodb = require('mongodb');
const PasswordUtils = require('../util/password');

class User {
    constructor(name, email, password = '', role = 'user', favorites = [], phone = '', address = '', status = 'active') {
        this.name = name;
        this.email = email;
        this.password = password; // Sẽ được mã hóa khi save
        this.role = role;
        this.favorites = favorites;
        this.phone = phone;
        this.address = address;
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.cart = { items: [], totalPrice: 0 };
        this.status = status;
        this.lastLoginAt = null;
        this.loginAttempts = 0;
        this.lockoutUntil = null;
    }

    async save() {
        try {
            const db = getDb();

            // ===== VALIDATION =====
            if (!this.name || !this.email) {
                throw new Error('Tên và email là bắt buộc');
            }

            // Kiểm tra email đã tồn tại
            const existingUser = await db.collection('users').findOne({ email: this.email });
            if (existingUser) {
                throw new Error('Email đã được sử dụng');
            }

            // ===== MÃ HÓA MẬT KHẨU =====
            if (this.password && this.password.length > 0) {
                // Kiểm tra độ mạnh mật khẩu
                const strengthCheck = PasswordUtils.validatePasswordStrength(this.password);
                if (!strengthCheck.isValid) {
                    throw new Error(strengthCheck.errors.join(', '));
                }

                // Kiểm tra mật khẩu yếu
                if (PasswordUtils.isWeakPassword(this.password)) {
                    throw new Error('Mật khẩu quá yếu, vui lòng chọn mật khẩu mạnh hơn');
                }

                // Kiểm tra mật khẩu có chứa thông tin cá nhân
                if (PasswordUtils.containsPersonalInfo(this.password, {
                    name: this.name,
                    email: this.email
                })) {
                    throw new Error('Mật khẩu không được chứa thông tin cá nhân');
                }

                // Mã hóa mật khẩu
                this.password = await PasswordUtils.hashPassword(this.password);
            }

            const result = await db.collection('users').insertOne(this);
            console.log('✅ User đã được tạo thành công:', this.email);
            return { ...this, _id: result.insertedId };
        } catch (error) {
            console.error('❌ Lỗi khi tạo user:', error);
            throw error;
        }
    }

    static async findByEmail(email) {
        const db = getDb();
        return await db.collection('users').findOne({ email: email });
    }

    static async findById(id) {
        const db = getDb();
        return await db.collection('users').findOne({ _id: new mongodb.ObjectId(id) });
    }

    static async updateName(userId, newName) {
        const db = getDb();
        try {
            return await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                {
                    $set: {
                        name: newName,
                        updatedAt: new Date()
                    }
                }
            );
        } catch (err) {
            console.error('Lỗi khi cập nhật tên user:', err);
            throw err;
        }
    }

    static async updatePassword(userId, newPassword) {
        const db = getDb();
        try {
            // ===== VALIDATION MẬT KHẨU MỚI =====
            const strengthCheck = PasswordUtils.validatePasswordStrength(newPassword);
            if (!strengthCheck.isValid) {
                throw new Error(strengthCheck.errors.join(', '));
            }

            if (PasswordUtils.isWeakPassword(newPassword)) {
                throw new Error('Mật khẩu quá yếu, vui lòng chọn mật khẩu mạnh hơn');
            }

            // Mã hóa mật khẩu mới
            const hashedPassword = await PasswordUtils.hashPassword(newPassword);

            return await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                {
                    $set: {
                        password: hashedPassword,
                        updatedAt: new Date(),
                        resetPasswordToken: null,
                        resetPasswordExpires: null
                    }
                }
            );
        } catch (err) {
            console.error('Lỗi khi cập nhật mật khẩu user:', err);
            throw err;
        }
    }

    static async generateNewPassword(userId) {
        const db = getDb();
        try {
            // Tạo mật khẩu ngẫu nhiên mạnh
            const newPassword = PasswordUtils.generateRandomPassword(12);

            // Mã hóa mật khẩu mới
            const hashedPassword = await PasswordUtils.hashPassword(newPassword);

            // Cập nhật mật khẩu mới vào database
            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                {
                    $set: {
                        password: hashedPassword,
                        updatedAt: new Date(),
                        resetPasswordToken: null,
                        resetPasswordExpires: null
                    }
                }
            );

            return newPassword; // Trả về mật khẩu gốc để gửi email
        } catch (err) {
            console.error('Lỗi khi tạo mật khẩu mới:', err);
            throw err;
        }
    }

    // ===== AUTHENTICATION METHODS =====

    static async authenticateUser(email, password) {
        try {
            const user = await this.findByEmail(email);
            if (!user) {
                return {
                    success: false,
                    message: 'Email không tồn tại'
                };
            }

            // Kiểm tra tài khoản bị tạm khóa (suspended)
            if (user.status === 'suspended') {
                return {
                    success: false,
                    message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.'
                };
            }

            // Kiểm tra tài khoản bị khóa
            if (user.lockoutUntil && new Date() < user.lockoutUntil) {
                const remainingTime = Math.ceil((user.lockoutUntil - new Date()) / 1000 / 60);
                return {
                    success: false,
                    message: `Tài khoản bị khóa. Vui lòng thử lại sau ${remainingTime} phút`
                };
            }

            // Kiểm tra mật khẩu
            const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
            if (!isPasswordValid) {
                // Tăng số lần đăng nhập sai
                await this.incrementLoginAttempts(user._id);
                return {
                    success: false,
                    message: 'Email hoặc mật khẩu không đúng'
                };
            }

            // Reset login attempts nếu đăng nhập thành công
            await this.resetLoginAttempts(user._id);

            // Cập nhật thời gian đăng nhập cuối
            await this.updateLastLogin(user._id);

            return {
                success: true,
                user: user
            };
        } catch (error) {
            console.error('Lỗi khi xác thực user:', error);
            return {
                success: false,
                message: 'Có lỗi xảy ra khi đăng nhập'
            };
        }
    }

    static async incrementLoginAttempts(userId) {
        const db = getDb();
        try {
            const user = await this.findById(userId);
            const newAttempts = (user.loginAttempts || 0) + 1;

            let updateData = {
                loginAttempts: newAttempts,
                updatedAt: new Date()
            };

            // Khóa tài khoản nếu vượt quá số lần thử
            if (newAttempts >= 5) {
                const lockoutTime = new Date();
                lockoutTime.setMinutes(lockoutTime.getMinutes() + 30); // Khóa 30 phút
                updateData.lockoutUntil = lockoutTime;
            }

            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                { $set: updateData }
            );
        } catch (err) {
            console.error('Lỗi khi tăng login attempts:', err);
        }
    }

    static async resetLoginAttempts(userId) {
        const db = getDb();
        try {
            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                {
                    $set: {
                        loginAttempts: 0,
                        lockoutUntil: null,
                        updatedAt: new Date()
                    }
                }
            );
        } catch (err) {
            console.error('Lỗi khi reset login attempts:', err);
        }
    }

    static async updateLastLogin(userId) {
        const db = getDb();
        try {
            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId) },
                {
                    $set: {
                        lastLoginAt: new Date(),
                        updatedAt: new Date()
                    }
                }
            );
        } catch (err) {
            console.error('Lỗi khi cập nhật last login:', err);
        }
    }

    async getCart() {
        try {
            if (!this._id) {
                console.error('User ID không tồn tại');
                return { items: [], totalPrice: 0 };
            }

            const db = getDb();
            const user = await db.collection('users').findOne({ _id: this._id });

            if (!user) {
                console.error('Không tìm thấy user');
                return { items: [], totalPrice: 0 };
            }

            if (!user.cart || !user.cart.items || user.cart.items.length === 0) {
                console.log('Giỏ hàng trống');
                return { items: [], totalPrice: 0 };
            }

            // Lấy thông tin sản phẩm cho mỗi item trong giỏ hàng
            const productIds = user.cart.items.map(item => {
                return item._id instanceof mongodb.ObjectId ?
                    item._id :
                    new mongodb.ObjectId(item._id);
            });

            const products = await db.collection('products')
                .find({ _id: { $in: productIds } })
                .toArray();

            // Map sản phẩm với số lượng
            const cartItems = user.cart.items.map(cartItem => {
                try {
                    const product = products.find(p =>
                        p._id.toString() === cartItem._id.toString()
                    );

                    if (!product) {
                        console.warn(`Không tìm thấy sản phẩm với ID: ${cartItem._id}`);
                        return null;
                    }

                    return {
                        _id: product._id,
                        title: product.title,
                        price: product.price || 0,
                        imageUrl: product.imageUrl,
                        quantity: cartItem.quantity || 1
                    };
                } catch (e) {
                    console.error(`Lỗi khi xử lý sản phẩm ID: ${cartItem._id}`, e);
                    return null;
                }
            }).filter(item => item !== null);




            // Tính tổng giá
            const totalPrice = cartItems.reduce((total, item) => {
                return total + ((item.price || 0) * (item.quantity || 1));
            }, 0);

            console.log('Giỏ hàng:', {
                items: cartItems,
                totalPrice: totalPrice
            });

            return {
                items: cartItems,
                totalPrice: totalPrice
            };
        } catch (err) {
            console.error('Lỗi khi lấy giỏ hàng:', err);
            return { items: [], totalPrice: 0 };
        }
    }

    async addToCart(product, quantity = 1) {
        try {
            if (!this._id) {
                console.error('User ID không tồn tại');
                return;
            }

            if (!product || !product._id) {
                console.error('Product hoặc Product ID không tồn tại');
                return;
            }

            // Kiểm tra số lượng tồn kho
            if (product.stockQuantity && quantity > product.stockQuantity) {
                throw new Error(`Số lượng vượt quá tồn kho. Chỉ còn ${product.stockQuantity} sản phẩm.`);
            }

            // Đảm bảo product._id là ObjectId
            const productId = product._id instanceof mongodb.ObjectId ?
                product._id :
                new mongodb.ObjectId(product._id);

            const db = getDb();

            // Lấy thông tin user hiện tại từ database để có cart mới nhất
            const currentUser = await db.collection('users').findOne({ _id: this._id });
            if (!currentUser) {
                throw new Error('Không tìm thấy user');
            }

            // Đảm bảo cart tồn tại
            const userCart = currentUser.cart || { items: [] };
            const updatedCartItems = [...(userCart.items || [])];

            const cartProductIndex = updatedCartItems.findIndex(cp => {
                return cp._id.toString() === productId.toString();
            });

            if (cartProductIndex > -1) {
                // Sản phẩm đã có trong giỏ hàng
                const newQuantity = updatedCartItems[cartProductIndex].quantity + quantity;
                if (product.stockQuantity && newQuantity > product.stockQuantity) {
                    throw new Error(`Số lượng vượt quá tồn kho. Chỉ còn ${product.stockQuantity} sản phẩm.`);
                }
                updatedCartItems[cartProductIndex].quantity = newQuantity;
            } else {
                // Thêm sản phẩm mới vào giỏ hàng
                updatedCartItems.push({
                    _id: productId,
                    quantity: quantity
                });
            }

            const updatedCart = {
                items: updatedCartItems
            };

            await db.collection('users').updateOne(
                { _id: this._id },
                { $set: { cart: updatedCart } }
            );

            console.log('Đã thêm sản phẩm vào giỏ hàng:', {
                productId: productId.toString(),
                quantity: quantity,
                cartItems: updatedCartItems
            });
        } catch (err) {
            console.error('Lỗi khi thêm vào giỏ hàng:', err);
            throw err;
        }
    }

    async removeFromCart(productId) {
        try {
            if (!this._id) {
                console.error('User chưa có _id');
                throw new Error('User chưa có _id');
            }

            const db = getDb();
            const cart = await this.getCart();
            const updatedCartItems = cart.items.filter(item => {
                return item._id.toString() !== productId.toString();
            });

            const updatedCart = {
                items: updatedCartItems,
                totalPrice: updatedCartItems.reduce((total, item) => {
                    return total + ((item.price || 0) * (item.quantity || 1));
                }, 0)
            };

            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(this._id) },
                { $set: { cart: updatedCart } }
            );
        } catch (err) {
            console.error('Lỗi khi xóa sản phẩm khỏi giỏ hàng:', err);
            throw err;
        }
    }

    async clearCart() {
        try {
            if (!this._id) {
                console.error('User chưa có _id');
                throw new Error('User chưa có _id');
            }

            const db = getDb();
            await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(this._id) },
                { $set: { cart: { items: [], totalPrice: 0 } } }
            );
        } catch (err) {
            console.error('Lỗi khi xóa giỏ hàng:', err);
            throw err;
        }
    }

    // Thêm sản phẩm vào danh sách yêu thích
    async addFavorite(productId) {
        try {
            const db = getDb();
            if (!this._id) {
                console.error('User chưa có _id');
                throw new Error('User chưa có _id');
            }

            const user = await db.collection('users').findOne({ _id: this._id });
            if (!user) {
                throw new Error('Không tìm thấy user');
            }

            if (!user.favorites) user.favorites = [];

            // Chuyển đổi productId thành ObjectId
            let objProductId;
            try {
                objProductId = typeof productId === 'string' ? new (require('mongodb')).ObjectId(productId) : productId;
            } catch (err) {
                console.error('Lỗi ObjectId không hợp lệ:', productId, err);
                throw new Error('ProductId không hợp lệ');
            }

            // Kiểm tra xem đã có trong favorites chưa
            const isAlreadyFavorited = user.favorites.some(id => {
                try {
                    return id.toString() === objProductId.toString();
                } catch (e) {
                    return false;
                }
            });

            if (!isAlreadyFavorited) {
                user.favorites.push(objProductId);
                await db.collection('users').updateOne(
                    { _id: this._id },
                    { $set: { favorites: user.favorites } }
                );
                console.log('Đã thêm sản phẩm vào favorites:', productId);
            } else {
                console.log('Sản phẩm đã có trong favorites:', productId);
            }
        } catch (err) {
            console.error('Lỗi khi thêm vào favorites:', err);
            throw err;
        }
    }

    // Xóa sản phẩm khỏi danh sách yêu thích
    async removeFavorite(productId) {
        try {
            const db = getDb();
            if (!this._id) {
                console.error('User chưa có _id');
                throw new Error('User chưa có _id');
            }

            const user = await db.collection('users').findOne({ _id: this._id });
            if (!user) {
                throw new Error('Không tìm thấy user');
            }

            if (!user.favorites) user.favorites = [];

            // Chuyển đổi productId thành ObjectId
            let objProductId;
            try {
                objProductId = typeof productId === 'string' ? new (require('mongodb')).ObjectId(productId) : productId;
            } catch (err) {
                console.error('Lỗi ObjectId không hợp lệ:', productId, err);
                throw new Error('ProductId không hợp lệ');
            }

            // Lọc ra những id không phải productId cần xóa
            user.favorites = user.favorites.filter(id => {
                try {
                    return id.toString() !== objProductId.toString();
                } catch (e) {
                    // Nếu id trong mảng không hợp lệ, loại bỏ luôn
                    console.warn('ID không hợp lệ trong favorites:', id);
                    return false;
                }
            });

            await db.collection('users').updateOne(
                { _id: this._id },
                { $set: { favorites: user.favorites } }
            );
            console.log('Đã xóa sản phẩm khỏi favorites:', productId);
        } catch (err) {
            console.error('Lỗi khi xóa khỏi favorites:', err);
            throw err;
        }
    }
    // Lấy danh sách sản phẩm yêu thích
    async getFavorites() {
        const db = getDb();
        if (!this._id) return [];
        const user = await db.collection('users').findOne({ _id: this._id });
        return user.favorites || [];
    }

    // Xóa tất cả sản phẩm khỏi danh sách yêu thích
    async clearFavorites() {
        const db = getDb();
        if (!this._id) return;
        await db.collection('users').updateOne(
            { _id: this._id },
            { $set: { favorites: [] } }
        );
        this.favorites = [];
    }

    static async updateProfile(userId, updateData) {
        const db = getDb();
        try {
            const updateFields = {};
            if (updateData.name) updateFields.name = updateData.name;
            if (updateData.phone !== undefined) updateFields.phone = updateData.phone;
            if (updateData.address !== undefined) updateFields.address = updateData.address;
            if (updateData.avatarUrl) updateFields.avatarUrl = updateData.avatarUrl;

            console.log('updateProfile called with:', {
                userId: userId,
                updateData: updateData,
                updateFields: updateFields
            });

            const result = await db.collection('users').updateOne(
                { _id: new mongodb.ObjectId(userId.toString()) },
                { $set: { ...updateFields, updatedAt: new Date() } }
            );

            console.log('updateProfile result:', result);
            return result;
        } catch (err) {
            console.error('Lỗi khi cập nhật thông tin profile:', err);
            throw err;
        }
    }
}

module.exports = User;