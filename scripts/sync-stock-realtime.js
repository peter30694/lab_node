const { mongoConnect } = require('../util/database');

async function syncStockData() {
    try {
        const db = require('../util/database').getDb();

        console.log('🔄 Đang đồng bộ dữ liệu tồn kho...');

        // Cập nhật tất cả sản phẩm có stockQuantity không hợp lệ
        const result = await db.collection('products').updateMany(
            {
                $or: [
                    { stockQuantity: { $exists: false } },
                    { stockQuantity: null },
                    { stockQuantity: { $type: "string" } }
                ]
            },
            {
                $set: {
                    stockQuantity: 0,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`✅ Đã cập nhật ${result.modifiedCount} sản phẩm`);

        // Lấy thống kê mới
        const stats = await db.collection('products').aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    outOfStock: { $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] } },
                    lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stockQuantity', 0] }, { $lte: ['$stockQuantity', 10] }] }, 1, 0] } },
                    inStock: { $sum: { $cond: [{ $gt: ['$stockQuantity', 10] }, 1, 0] } }
                }
            }
        ]).toArray();

        console.log('📊 Thống kê tồn kho hiện tại:', stats[0]);

    } catch (err) {
        console.error('❌ Lỗi khi đồng bộ tồn kho:', err);
    }
}

mongoConnect(async (client) => {
    if (!client) {
        console.error('Kết nối MongoDB thất bại!');
        process.exit(1);
    }

    await syncStockData();
    process.exit(0);
});