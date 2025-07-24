const mongodb = require('mongodb');
require('dotenv').config();

const MongoClient = mongodb.MongoClient;

let _db;

const mongoConnect = (callback) => {
    console.log('Đang kết nối đến MongoDB...');
    console.log('URI:', process.env.MONGODB_URI);

    const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    };

    MongoClient.connect(process.env.MONGODB_URI, options)
        .then(client => {
            console.log('Đã kết nối với MongoDB thành công!');
            _db = client.db();
            console.log('Database name:', _db.databaseName);
            callback(client); // Truyền client vào callback
        })
        .catch(err => {
            console.error('Lỗi kết nối MongoDB:', err);
            callback(null); // Truyền null khi có lỗi
        });
}

const getDb = () => {
    if (_db) {
        return _db;
    }
    throw 'Không tìm thấy database!';
}

exports.mongoConnect = mongoConnect;
exports.getDb = getDb;

