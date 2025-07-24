const { mongoConnect } = require('../util/database');
const fs = require('fs');
const path = require('path');

const imageDir = path.join(__dirname, '../public/images/products');

// Đọc tất cả file ảnh trong thư mục
const imageFiles = fs.readdirSync(imageDir);

// Tạo map: tên không đuôi -> tên file
const imageMap = {};
imageFiles.forEach(file => {
    const name = path.parse(file).name.trim();
    imageMap[name.toLowerCase()] = file;
});

mongoConnect(async (client) => {
    if (!client) {
        console.error('Kết nối MongoDB thất bại!');
        process.exit(1);
    }
    try {
        const db = require('../util/database').getDb();
        const products = await db.collection('products').find({}).toArray();
        let updated = 0;
        for (const product of products) {
            const prodName = product.title.trim().toLowerCase();
            if (imageMap[prodName]) {
                const newImageUrl = '/images/products/' + imageMap[prodName];
                if (product.imageUrl !== newImageUrl) {
                    await db.collection('products').updateOne(
                        { _id: product._id },
                        { $set: { imageUrl: newImageUrl } }
                    );
                    updated++;
                    console.log(`Đã cập nhật imageUrl cho sản phẩm '${product.title}' -> ${newImageUrl}`);
                }
            }
        }
        console.log(`Đã đồng bộ ${updated} sản phẩm với ảnh thực tế.`);
        process.exit(0);
    } catch (err) {
        console.error('Lỗi khi đồng bộ imageUrl:', err);
        process.exit(1);
    }
}); 