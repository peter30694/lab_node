const mongodb = require('mongodb');
const { mongoConnect, getDb } = require('../util/database');

// Dữ liệu sản phẩm cho từng danh mục
const productsByCategory = {
    'dog': [
        {
            title: 'Bánh thưởng cho chó SmartBones',
            description: 'Bánh thưởng dinh dưỡng giúp chó phát triển khỏe mạnh, chứa vitamin và khoáng chất cần thiết',
            price: 85000,
            stockQuantity: 20,
            category: 'dog',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Vòng cổ chó có đèn LED',
            description: 'Vòng cổ có đèn LED sáng, an toàn cho chó đi dạo ban đêm, có thể điều chỉnh độ sáng',
            price: 120000,
            stockQuantity: 20,
            category: 'dog',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Bàn chải đánh răng cho chó',
            description: 'Bàn chải đánh răng chuyên dụng cho chó, giúp vệ sinh răng miệng, ngăn ngừa bệnh nướu răng',
            price: 45000,
            stockQuantity: 20,
            category: 'dog',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Áo khoác cho chó mùa đông',
            description: 'Áo khoác ấm áp cho chó trong mùa đông, chất liệu cotton mềm mại, có khóa kéo dễ mặc',
            price: 180000,
            stockQuantity: 20,
            category: 'dog',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Bát ăn tự động cho chó',
            description: 'Bát ăn tự động có hẹn giờ, phù hợp cho chó cần ăn theo lịch trình, dung tích 2L',
            price: 250000,
            stockQuantity: 20,
            category: 'dog',
            imageUrl: '/images/products/default-product.png'
        }
    ],
    'cat': [
        {
            title: 'Thức ăn cho mèo Royal Canin',
            description: 'Thức ăn cao cấp cho mèo, chứa protein chất lượng cao, omega-3 và taurine cho mắt sáng',
            price: 150000,
            stockQuantity: 20,
            category: 'cat',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Cây cào móng cao cấp',
            description: 'Cây cào móng nhiều tầng cho mèo, có nơi nghỉ ngơi và đồ chơi treo, chất liệu sisal bền',
            price: 350000,
            stockQuantity: 20,
            category: 'cat',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Bàn chải lông cho mèo',
            description: 'Bàn chải chuyên dụng để chải lông mèo, loại bỏ lông rụng, massage da, giảm búi lông',
            price: 75000,
            stockQuantity: 20,
            category: 'cat',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Đồ chơi laser cho mèo',
            description: 'Đồ chơi laser kích thích bản năng săn mồi của mèo, có chế độ tự động và thủ công',
            price: 95000,
            stockQuantity: 20,
            category: 'cat',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Nhà vệ sinh tự động cho mèo',
            description: 'Nhà vệ sinh tự động vệ sinh, có cảm biến, hẹn giờ, phù hợp cho mèo trong nhà',
            price: 1200000,
            stockQuantity: 20,
            category: 'cat',
            imageUrl: '/images/products/default-product.png'
        }
    ],
    'fish': [
        {
            title: 'Bể cá thủy tinh 50L',
            description: 'Bể cá thủy tinh trong suốt, có nắp đậy, phù hợp nuôi cá cảnh nhỏ và trung bình',
            price: 450000,
            stockQuantity: 20,
            category: 'fish',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Máy lọc nước cho bể cá',
            description: 'Máy lọc nước 3 tầng, lọc cơ học, hóa học và sinh học, giữ nước sạch cho cá',
            price: 280000,
            stockQuantity: 20,
            category: 'fish',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Thức ăn cho cá Koi',
            description: 'Thức ăn chuyên dụng cho cá Koi, chứa protein cao, vitamin và khoáng chất',
            price: 120000,
            stockQuantity: 20,
            category: 'fish',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Đèn LED cho bể cá',
            description: 'Đèn LED chuyên dụng cho bể cá, ánh sáng tự nhiên, tiết kiệm điện, tăng màu sắc cá',
            price: 180000,
            stockQuantity: 20,
            category: 'fish',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Cây thủy sinh trang trí',
            description: 'Cây thủy sinh tự nhiên, tạo oxy cho bể cá, trang trí đẹp mắt, dễ chăm sóc',
            price: 85000,
            stockQuantity: 20,
            category: 'fish',
            imageUrl: '/images/products/default-product.png'
        }
    ],
    'small-pets': [
        {
            title: 'Thức ăn cho thỏ timothy',
            description: 'Thức ăn chuyên dụng cho thỏ, chứa cỏ timothy, rau xanh và vitamin cần thiết',
            price: 95000,
            stockQuantity: 20,
            category: 'small-pets',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Chuồng nuôi thỏ rộng rãi',
            description: 'Chuồng nuôi thỏ 2 tầng, có nơi ăn uống và nghỉ ngơi, dễ dọn dẹp, an toàn',
            price: 380000,
            stockQuantity: 20,
            category: 'small-pets',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Đồ chơi cho chuột hamster',
            description: 'Bộ đồ chơi đa dạng cho hamster, có bánh xe, ống chạy, cầu thang, kích thích vận động',
            price: 150000,
            stockQuantity: 20,
            category: 'small-pets',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Thức ăn cho chim cảnh',
            description: 'Hỗn hợp hạt dinh dưỡng cho chim cảnh, chứa đa dạng hạt, vitamin và khoáng chất',
            price: 65000,
            stockQuantity: 20,
            category: 'small-pets',
            imageUrl: '/images/products/default-product.png'
        },
        {
            title: 'Lồng chim cao cấp',
            description: 'Lồng chim 3 tầng, có đầy đủ phụ kiện, khay ăn, cầu đậu, dễ dọn dẹp và chăm sóc',
            price: 420000,
            stockQuantity: 20,
            category: 'small-pets',
            imageUrl: '/images/products/default-product.png'
        }
    ]
};

async function addProductsByCategory() {
    try {
        console.log('🔄 Bắt đầu thêm sản phẩm cho từng danh mục...');
        
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
        
        // Thêm sản phẩm cho từng danh mục
        for (const [category, products] of Object.entries(productsByCategory)) {
            console.log(`\n📦 Đang thêm sản phẩm cho danh mục: ${category}`);
            
            for (const product of products) {
                // Thêm thời gian tạo và cập nhật
                const productData = {
                    ...product,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                const result = await db.collection('products').insertOne(productData);
                console.log(`  ✅ Đã thêm: ${product.title} - ${product.price.toLocaleString('vi-VN')} VNĐ`);
            }
            
            console.log(`✅ Hoàn thành thêm ${products.length} sản phẩm cho danh mục ${category}`);
        }
        
        // Hiển thị thống kê tổng quan
        const totalProducts = await db.collection('products').countDocuments();
        const productsByCategoryCount = await db.collection('products').aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        
        console.log('\n📊 Thống kê sau khi thêm sản phẩm:');
        console.log(`Tổng số sản phẩm: ${totalProducts}`);
        
        productsByCategoryCount.forEach(item => {
            const categoryName = {
                'dog': '🐶 Chó cưng',
                'cat': '🐱 Mèo cưng', 
                'fish': '🐟 Cá cảnh',
                'small-pets': '🐹 Thú nhỏ'
            }[item._id] || item._id;
            
            console.log(`  ${categoryName}: ${item.count} sản phẩm`);
        });
        
    } catch (error) {
        console.error('❌ Lỗi khi thêm sản phẩm:', error);
        throw error;
    }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
    addProductsByCategory()
        .then(() => {
            console.log('\n🎉 Hoàn thành thêm sản phẩm cho tất cả danh mục!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Có lỗi xảy ra:', error);
            process.exit(1);
        });
}

module.exports = { addProductsByCategory }; 