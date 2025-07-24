const { mongoConnect } = require('../util/database');

// Danh sách category hợp lệ
const validCategories = ['Chăm sóc', 'Huấn luyện', 'Sức khỏe', 'Trông giữ', 'Tư vấn', 'Vận chuyển'];
const defaultCategory = 'Chăm sóc';

mongoConnect(async (client) => {
    if (!client) {
        console.error('Kết nối MongoDB thất bại!');
        process.exit(1);
    }
    try {
        const db = require('../util/database').getDb();
        const services = await db.collection('services').find({}).toArray();
        let fixed = 0;
        for (const service of services) {
            const cat = service.category;
            if (!validCategories.includes(cat)) {
                // Nếu là đường dẫn ảnh hoặc giá trị không hợp lệ, sửa thành defaultCategory
                await db.collection('services').updateOne(
                    { _id: service._id },
                    { $set: { category: defaultCategory } }
                );
                fixed++;
                console.log(`Đã sửa category cho service _id=${service._id}`);
            }
        }
        console.log(`Đã sửa ${fixed} dịch vụ có category không hợp lệ.`);
        process.exit(0);
    } catch (err) {
        console.error('Lỗi khi sửa category:', err);
        process.exit(1);
    }
}); 