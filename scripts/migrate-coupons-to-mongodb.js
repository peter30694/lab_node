const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

async function migrateCouponsToMongoDB() {
    let client;
    try {
        // Kết nối MongoDB
        const uri = process.env.MONGODB_URI || 'mongodb+srv://ITCschool:8GZ4Vs2IufF9uwFY@cluster0.unzei.mongodb.net/Shop?retryWrites=true&w=majority&appName=Cluster0';
        client = new MongoClient(uri);
        await client.connect();
        console.log('✅ Đã kết nối MongoDB thành công');

        const db = client.db();
        const couponsCollection = db.collection('coupons');

        // Đọc dữ liệu từ file JSON
        const jsonFilePath = path.join(__dirname, '../data/coupons.json');
        const jsonData = await fs.readFile(jsonFilePath, 'utf8');
        const coupons = JSON.parse(jsonData);

        console.log(`📋 Đọc được ${coupons.length} mã giảm giá từ file JSON`);

        // Xóa tất cả mã giảm giá cũ trong MongoDB
        await couponsCollection.deleteMany({});
        console.log('🗑️ Đã xóa mã giảm giá cũ trong MongoDB');

        // Chuyển đổi dữ liệu và thêm vào MongoDB
        const couponsToInsert = coupons.map(coupon => ({
            ...coupon,
            startDate: new Date(coupon.startDate),
            endDate: new Date(coupon.endDate),
            createdAt: new Date(coupon.createdAt),
            _id: undefined // Để MongoDB tự tạo _id
        }));

        const result = await couponsCollection.insertMany(couponsToInsert);
        console.log(`✅ Đã chuyển ${result.insertedCount} mã giảm giá sang MongoDB`);

        // Hiển thị danh sách mã giảm giá đã chuyển
        console.log('\n📊 Danh sách mã giảm giá đã chuyển:');
        coupons.forEach(coupon => {
            console.log(`   - ${coupon.code}: ${coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue.toLocaleString('vi-VN')}đ`} (Đơn hàng tối thiểu: ${coupon.minOrderValue.toLocaleString('vi-VN')}đ)`);
        });

        // Kiểm tra dữ liệu trong MongoDB
        const totalCoupons = await couponsCollection.countDocuments();
        console.log(`\n🔍 Kiểm tra: Có ${totalCoupons} mã giảm giá trong MongoDB`);

        // Test một vài mã giảm giá
        console.log('\n🧪 Test validate mã giảm giá:');
        const testCoupons = ['SALE10', 'GIAM50K', 'WELCOME20'];
        
        for (const code of testCoupons) {
            const coupon = await couponsCollection.findOne({ code: code });
            if (coupon) {
                console.log(`   ✅ ${code}: Tìm thấy trong MongoDB`);
            } else {
                console.log(`   ❌ ${code}: Không tìm thấy trong MongoDB`);
            }
        }

        console.log('\n🎉 Migration hoàn thành thành công!');
        console.log('💡 Bây giờ hệ thống sẽ sử dụng MongoDB thay vì file JSON');

    } catch (error) {
        console.error('❌ Lỗi khi migration:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 Hãy đảm bảo MongoDB đang chạy');
        }
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 Đã đóng kết nối MongoDB');
        }
    }
}

// Chạy migration
migrateCouponsToMongoDB(); 