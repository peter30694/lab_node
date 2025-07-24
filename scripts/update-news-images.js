const mongoose = require('mongoose');
const News = require('../models/news');

// Kết nối MongoDB
mongoose.connect('mongodb+srv://ITCschool:8GZ4Vs2IufF9uwFY@cluster0.unzei.mongodb.net/Shop?retryWrites=true&w=majority&appName=Cluster0');

async function updateNewsImages() {
    // Danh sách tên file ảnh muốn gán
    const imageFiles = [
        'news1.jpg',
        'news2.jpg',
        'news3.jpg',
        'news4.jpg',
        'news5.jpg',
        'news6.jpg'
    ];

    const newsList = await News.find().sort({ createdAt: 1 }).limit(imageFiles.length);
    for (let i = 0; i < newsList.length; i++) {
        newsList[i].imageUrl = '/images/news/' + imageFiles[i];
        await newsList[i].save();
        console.log(`Đã cập nhật tin: ${newsList[i].title} với ảnh ${imageFiles[i]}`);
    }
    mongoose.disconnect();
}

updateNewsImages(); 