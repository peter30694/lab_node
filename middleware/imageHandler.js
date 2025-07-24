const path = require('path');
const fs = require('fs');

const defaultNames = [
    'default-product.jpg',
    'default-product.png',
    'default-product.jpeg',
    'default-product.webp'
];

const imageHandler = (req, res, next) => {
    if (req.path.startsWith('/images/products/')) {
        const imagePath = path.join(__dirname, '..', 'public', req.path);

        if (!fs.existsSync(imagePath)) {
            // Thử lần lượt các file mặc định
            for (const name of defaultNames) {
                const defaultPath = path.join(__dirname, '..', 'public', 'images', name);
                if (fs.existsSync(defaultPath)) {
                    return res.sendFile(defaultPath);
                }
            }
            // Nếu không có file nào, trả về 404
            return res.status(404).end();
        }
    }
    next();
};

module.exports = imageHandler; 