const mongodb = require('mongodb');
const getDb = require('../util/database').getDb;

module.exports = class Product {
    constructor(id, title, imageUrl, description, price, stockQuantity = 0, category = null, origin = '') {
        this._id = id ? new mongodb.ObjectId(id) : null;
        this.title = title;
        this.imageUrl = imageUrl;
        this.description = description;
        this.price = parseFloat(price);
        this.stockQuantity = parseInt(stockQuantity);
        this.category = category;
        this.origin = origin || '';
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    async save() {
        try {
            const db = getDb();
            let result;

            if (this._id) {
                // Cập nhật sản phẩm
                this.updatedAt = new Date();
                result = await db.collection('products').updateOne(
                    { _id: this._id },
                    {
                        $set: {
                            title: this.title,
                            imageUrl: this.imageUrl,
                            description: this.description,
                            price: this.price,
                            stockQuantity: this.stockQuantity,
                            category: this.category,
                            origin: this.origin,
                            updatedAt: this.updatedAt
                        }
                    }
                );
                console.log('Đã cập nhật sản phẩm:', result);
            } else {
                // Thêm sản phẩm mới
                result = await db.collection('products').insertOne({
                    title: this.title,
                    imageUrl: this.imageUrl,
                    description: this.description,
                    price: this.price,
                    stockQuantity: this.stockQuantity,
                    category: this.category,
                    origin: this.origin,
                    createdAt: this.createdAt,
                    updatedAt: this.updatedAt
                });
                console.log('Đã thêm sản phẩm mới:', result);
            }
            return result;
        } catch (err) {
            console.error('Lỗi khi lưu sản phẩm:', err);
            throw err;
        }
    }

    static async fetchAll() {
        try {
            const db = getDb();
            console.log('Đang lấy danh sách sản phẩm từ MongoDB...');
            const products = await db.collection('products')
                .find()
                .sort({ createdAt: -1 })
                .toArray();
            console.log('Số sản phẩm tìm thấy:', products.length);
            return products;
        } catch (err) {
            console.error('Lỗi khi lấy danh sách sản phẩm:', err);
            throw err;
        }
    }

    static async find(filter = {}) {
        try {
            const db = getDb();
            console.log('Đang tìm sản phẩm với filter:', filter);
            const products = await db.collection('products')
                .find(filter)
                .sort({ createdAt: -1 })
                .toArray();
            console.log('Số sản phẩm tìm thấy:', products.length);
            return products;
        } catch (err) {
            console.error('Lỗi khi tìm sản phẩm:', err);
            throw err;
        }
    }

    static async findById(productId) {
        try {
            const db = getDb();
            console.log('Đang tìm sản phẩm với ID:', productId);
            const product = await db.collection('products')
                .findOne({ _id: new mongodb.ObjectId(productId) });
            console.log('Kết quả tìm kiếm:', product);
            return product;
        } catch (err) {
            console.error('Lỗi khi tìm sản phẩm:', err);
            throw err;
        }
    }

    static async deleteById(productId) {
        try {
            const db = getDb();
            const result = await db.collection('products')
                .deleteOne({ _id: new mongodb.ObjectId(productId) });
            console.log('Đã xóa sản phẩm:', result);
            return result;
        } catch (err) {
            console.error('Lỗi khi xóa sản phẩm:', err);
            throw err;
        }
    }

    static async findRelatedProducts(product, limit = 4) {
        try {
            const db = getDb();
            const relatedProducts = await db.collection('products')
                .find({
                    _id: { $ne: product._id },
                    price: {
                        $gte: product.price * 0.8,
                        $lte: product.price * 1.2
                    }
                })
                .limit(limit)
                .toArray();
            return relatedProducts;
        } catch (err) {
            console.error('Lỗi khi tìm sản phẩm liên quan:', err);
            throw err;
        }
    }

    // Cập nhật số lượng tồn kho khi đặt hàng thành công
    static async updateStock(productId, quantity) {
        try {
            if (!productId) {
                throw new Error('Product ID là bắt buộc');
            }
            if (!quantity || quantity <= 0) {
                throw new Error('Số lượng phải lớn hơn 0');
            }

            const db = getDb();
            console.log(`🔄 Cập nhật tồn kho: Sản phẩm ${productId}, giảm ${quantity}`);

            // Sử dụng findOneAndUpdate để tránh race condition
            const result = await db.collection('products').findOneAndUpdate(
                {
                    _id: new mongodb.ObjectId(productId),
                    stockQuantity: { $gte: quantity } // Chỉ cập nhật nếu đủ tồn kho
                },
                {
                    $inc: { stockQuantity: -quantity },
                    $set: { updatedAt: new Date() }
                },
                {
                    returnDocument: 'after',
                    projection: { title: 1, stockQuantity: 1 }
                }
            );

            if (!result.value) {
                throw new Error(`Không đủ tồn kho hoặc không tìm thấy sản phẩm với ID: ${productId}`);
            }

            console.log(`✅ Đã cập nhật tồn kho sản phẩm ${productId}: giảm ${quantity}, còn lại: ${result.value.stockQuantity}`);
            return result.value;
        } catch (err) {
            console.error('❌ Lỗi khi cập nhật tồn kho:', err);
            throw err;
        }
    }

    // Cập nhật tồn kho cho nhiều sản phẩm (khi đặt hàng)
    static async updateStockForOrder(orderItems) {
        try {
            if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
                console.warn('⚠️ updateStockForOrder: orderItems rỗng hoặc không hợp lệ');
                return;
            }

            console.log('🔄 Bắt đầu cập nhật tồn kho cho đơn hàng:', orderItems);

            const db = getDb();
            const session = db.client.startSession();

            try {
                await session.withTransaction(async () => {
                    const updatePromises = orderItems.map(async (item) => {
                        if (!item.productId || !item.quantity) {
                            console.warn('⚠️ updateStockForOrder: item không hợp lệ:', item);
                            return;
                        }

                        const result = await db.collection('products').findOneAndUpdate(
                            {
                                _id: new mongodb.ObjectId(item.productId),
                                stockQuantity: { $gte: item.quantity }
                            },
                            {
                                $inc: { stockQuantity: -item.quantity },
                                $set: { updatedAt: new Date() }
                            },
                            {
                                returnDocument: 'after',
                                session,
                                projection: { title: 1, stockQuantity: 1 }
                            }
                        );

                        if (!result.value) {
                            throw new Error(`Không đủ tồn kho cho sản phẩm: ${item.title || item.productId}`);
                        }

                        console.log(`✅ Đã cập nhật tồn kho: ${result.value.title} - giảm ${item.quantity}, còn lại: ${result.value.stockQuantity}`);
                    });

                    await Promise.all(updatePromises);
                });

                console.log('✅ Đã cập nhật tồn kho cho tất cả sản phẩm trong đơn hàng');
            } finally {
                await session.endSession();
            }
        } catch (err) {
            console.error('❌ Lỗi khi cập nhật tồn kho cho đơn hàng:', err);
            throw err;
        }
    }

    // Hoàn lại tồn kho khi hủy đơn hàng
    static async restoreStock(productId, quantity) {
        try {
            if (!productId) {
                throw new Error('Product ID là bắt buộc');
            }
            if (!quantity || quantity <= 0) {
                throw new Error('Số lượng phải lớn hơn 0');
            }

            const db = getDb();
            console.log(`🔄 Hoàn lại tồn kho: Sản phẩm ${productId}, tăng ${quantity}`);

            const result = await db.collection('products').findOneAndUpdate(
                { _id: new mongodb.ObjectId(productId) },
                {
                    $inc: { stockQuantity: quantity },
                    $set: { updatedAt: new Date() }
                },
                {
                    returnDocument: 'after',
                    projection: { title: 1, stockQuantity: 1 }
                }
            );

            if (!result.value) {
                throw new Error(`Không tìm thấy sản phẩm với ID: ${productId}`);
            }

            console.log(`✅ Đã hoàn lại tồn kho sản phẩm ${productId}: tăng ${quantity}, tổng: ${result.value.stockQuantity}`);
            return result.value;
        } catch (err) {
            console.error('❌ Lỗi khi hoàn lại tồn kho:', err);
            throw err;
        }
    }

    // Hoàn lại tồn kho cho nhiều sản phẩm (khi hủy đơn hàng)
    static async restoreStockForOrder(orderItems) {
        try {
            if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
                console.warn('⚠️ restoreStockForOrder: orderItems rỗng hoặc không hợp lệ');
                return;
            }

            console.log('🔄 Bắt đầu hoàn lại tồn kho cho đơn hàng bị hủy:', orderItems);

            const db = getDb();
            const session = db.client.startSession();

            try {
                await session.withTransaction(async () => {
                    const restorePromises = orderItems.map(async (item) => {
                        if (!item.productId || !item.quantity) {
                            console.warn('⚠️ restoreStockForOrder: item không hợp lệ:', item);
                            return;
                        }

                        const result = await db.collection('products').findOneAndUpdate(
                            { _id: new mongodb.ObjectId(item.productId) },
                            {
                                $inc: { stockQuantity: item.quantity },
                                $set: { updatedAt: new Date() }
                            },
                            {
                                returnDocument: 'after',
                                session,
                                projection: { title: 1, stockQuantity: 1 }
                            }
                        );

                        if (!result.value) {
                            console.warn(`⚠️ Không tìm thấy sản phẩm để hoàn lại tồn kho: ${item.productId}`);
                            return;
                        }

                        console.log(`✅ Đã hoàn lại tồn kho: ${result.value.title} - tăng ${item.quantity}, tổng: ${result.value.stockQuantity}`);
                    });

                    await Promise.all(restorePromises);
                });

                console.log('✅ Đã hoàn lại tồn kho cho tất cả sản phẩm trong đơn hàng bị hủy');
            } finally {
                await session.endSession();
            }
        } catch (err) {
            console.error('❌ Lỗi khi hoàn lại tồn kho cho đơn hàng:', err);
            throw err;
        }
    }

    // Kiểm tra tồn kho có đủ không
    static async checkStockAvailability(productId, quantity) {
        try {
            if (!productId || !quantity || quantity <= 0) {
                return { available: false, message: 'Tham số không hợp lệ', currentStock: 0 };
            }

            const db = getDb();
            const product = await db.collection('products').findOne(
                { _id: new mongodb.ObjectId(productId) },
                { projection: { title: 1, stockQuantity: 1 } }
            );

            if (!product) {
                return { available: false, message: 'Sản phẩm không tồn tại', currentStock: 0 };
            }

            // Đảm bảo stockQuantity là số hợp lệ
            const currentStock = parseInt(product.stockQuantity) || 0;

            if (currentStock < quantity) {
                return {
                    available: false,
                    message: `Chỉ còn ${currentStock} sản phẩm trong kho`,
                    currentStock: currentStock,
                    requestedQuantity: quantity
                };
            }

            return {
                available: true,
                message: 'Đủ hàng trong kho',
                currentStock: currentStock,
                requestedQuantity: quantity
            };
        } catch (err) {
            console.error('❌ Lỗi khi kiểm tra tồn kho:', err);
            return { available: false, message: 'Có lỗi xảy ra khi kiểm tra tồn kho', currentStock: 0 };
        }
    }

    // Lấy danh sách sản phẩm sắp hết hàng (tồn kho <= 10)
    static async getLowStockProducts(limit = 20) {
        try {
            const db = getDb();
            const products = await db.collection('products')
                .find({
                    stockQuantity: { $gt: 0, $lte: 10 }
                })
                .sort({ stockQuantity: 1, updatedAt: -1 })
                .limit(limit)
                .toArray();

            return products;
        } catch (err) {
            console.error('❌ Lỗi khi lấy danh sách sản phẩm sắp hết hàng:', err);
            return [];
        }
    }

    // Lấy thống kê tồn kho
    static async getStockStatistics() {
        try {
            const db = getDb();

            const stats = await db.collection('products').aggregate([
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        totalStockValue: { $sum: { $multiply: ['$price', '$stockQuantity'] } },
                        inStock: { $sum: { $cond: [{ $gt: ['$stockQuantity', 10] }, 1, 0] } },
                        lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stockQuantity', 0] }, { $lte: ['$stockQuantity', 10] }] }, 1, 0] } },
                        outOfStock: { $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] } }
                    }
                }
            ]).toArray();

            return stats[0] || {
                totalProducts: 0,
                totalStockValue: 0,
                inStock: 0,
                lowStock: 0,
                outOfStock: 0
            };
        } catch (err) {
            console.error('❌ Lỗi khi lấy thống kê tồn kho:', err);
            return {
                totalProducts: 0,
                totalStockValue: 0,
                inStock: 0,
                lowStock: 0,
                outOfStock: 0
            };
        }
    }
}