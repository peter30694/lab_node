const fs = require('fs');
const path = require('path');
const Product = require('../models/product');
const { mongoConnect } = require('../util/database');

mongoConnect(async (client) => {
    if (!client) {
        console.error('Kết nối MongoDB thất bại!');
        process.exit(1);
    }
    try {
        const products = await Product.fetchAll();
        const names = products.map(p => p.title);
        const filePath = path.join(__dirname, '../product-names.txt');
        fs.writeFileSync(filePath, names.join('\n'), 'utf8');
        console.log(`Đã xuất ${names.length} tên sản phẩm ra file: ${filePath}`);
        process.exit(0);
    } catch (err) {
        console.error('Lỗi khi xuất tên sản phẩm:', err);
        process.exit(1);
    }
}); 