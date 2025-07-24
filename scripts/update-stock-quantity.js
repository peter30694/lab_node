const mongodb = require('mongodb');
const { mongoConnect, getDb } = require('../util/database');

async function updateAllProductStock() {
    try {
        console.log('🔄 Bắt đầu cập nhật tồn kho cho tất cả sản phẩm...');
        
        // Khởi tạo kết nối database
        await new Promise((resolve, reject) => {
            mongoConnect((client) => {
                if (client) {
                    console.log('✅ Đã kết nối database thành công');
                    resolve();
                } else {
                    reject(new Error('Không thể kết nối database'));
                }
            });
        });
        
        const db = getDb();
        
        // Lấy tổng số sản phẩm trước khi cập nhật
        const totalProducts = await db.collection('products').countDocuments();
        console.log(`📊 Tổng số sản phẩm trong database: ${totalProducts}`);
        
        if (totalProducts === 0) {
            console.log('⚠️ Không có sản phẩm nào trong database');
            return;
        }
        
        // Cập nhật tồn kho của tất cả sản phẩm lên 20 đơn vị
        const result = await db.collection('products').updateMany(
            {}, // Cập nhật tất cả sản phẩm
            {
                $set: {
                    stockQuantity: 20,
                    updatedAt: new Date()
                }
            }
        );
        
        console.log(`✅ Đã cập nhật thành công ${result.modifiedCount} sản phẩm`);
        console.log(`📈 Tất cả sản phẩm đã được cập nhật tồn kho lên 20 đơn vị`);
        
        // Hiển thị thông tin chi tiết về các sản phẩm đã được cập nhật
        const updatedProducts = await db.collection('products')
            .find({}, { projection: { title: 1, stockQuantity: 1, price: 1 } })
            .toArray();
        
        console.log('\n📋 Danh sách sản phẩm sau khi cập nhật:');
        updatedProducts.forEach((product, index) => {
            console.log(`${index + 1}. ${product.title} - Tồn kho: ${product.stockQuantity} - Giá: ${product.price.toLocaleString('vi-VN')} VNĐ`);
        });
        
        // Tính tổng giá trị tồn kho
        const totalStockValue = updatedProducts.reduce((total, product) => {
            return total + (product.price * product.stockQuantity);
        }, 0);
        
        console.log(`\n💰 Tổng giá trị tồn kho: ${totalStockValue.toLocaleString('vi-VN')} VNĐ`);
        
    } catch (error) {
        console.error('❌ Lỗi khi cập nhật tồn kho:', error);
        throw error;
    }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
    updateAllProductStock()
        .then(() => {
            console.log('\n🎉 Hoàn thành cập nhật tồn kho!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Có lỗi xảy ra:', error);
            process.exit(1);
        });
}

module.exports = { updateAllProductStock }; 