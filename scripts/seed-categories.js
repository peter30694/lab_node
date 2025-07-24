const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Category = require('../models/category');

const categories = [
    {
        name: 'Chó cưng',
        slug: 'dog',
        description: 'Thức ăn và phụ kiện cho chó',
        icon: '🐶'
    },
    {
        name: 'Mèo cưng',
        slug: 'cat',
        description: 'Thức ăn và phụ kiện cho mèo',
        icon: '🐱'
    },
    {
        name: 'Cá cảnh',
        slug: 'fish',
        description: 'Thức ăn và phụ kiện cho cá',
        icon: '🐟'
    },
    {
        name: 'Thú nhỏ',
        slug: 'small-pets',
        description: 'Thức ăn và phụ kiện cho thú nhỏ',
        icon: '🐹'
    }
];

async function seedCategories() {
    try {
        console.log('🌱 Starting to seed categories...');
        
        // Clear existing categories
        await Category.deleteMany({});
        console.log('🗑️  Cleared existing categories');
        
        // Insert new categories
        const result = await Category.insertMany(categories);
        console.log(`✅ Successfully seeded ${result.length} categories`);
        
        // Display seeded categories
        result.forEach(cat => {
            console.log(`  - ${cat.name} (${cat.slug})`);
        });
        
        console.log('🎉 Categories seeding completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding categories:', error);
        process.exit(1);
    }
}

seedCategories(); 