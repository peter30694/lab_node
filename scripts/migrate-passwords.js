const mongoose = require('mongoose');
const PasswordUtils = require('../util/password');
const config = require('../config');

async function migratePasswords() {
    try {
        console.log('🔄 Bắt đầu migrate mật khẩu...');
        
        // Kết nối database với cấu hình đơn giản
        await mongoose.connect(config.database.uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Đã kết nối database');
        
        const db = mongoose.connection.db;
        
        // Lấy tất cả users có mật khẩu chưa được mã hóa
        const users = await db.collection('users').find({
            password: { $exists: true, $ne: null }
        }).toArray();
        
        console.log(`📊 Tìm thấy ${users.length} users cần migrate`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of users) {
            try {
                // Kiểm tra xem mật khẩu đã được mã hóa chưa
                if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
                    console.log(`🔄 Migrating password cho user: ${user.email}`);
                    
                    // Mã hóa mật khẩu cũ
                    const hashedPassword = await PasswordUtils.hashPassword(user.password);
                    
                    // Cập nhật vào database
                    await db.collection('users').updateOne(
                        { _id: user._id },
                        { 
                            $set: { 
                                password: hashedPassword,
                                updatedAt: new Date()
                            } 
                        }
                    );
                    
                    successCount++;
                    console.log(`✅ Đã migrate password cho: ${user.email}`);
                } else {
                    console.log(`⏭️ Password đã được mã hóa cho: ${user.email}`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Lỗi khi migrate password cho ${user.email}:`, error.message);
            }
        }
        
        console.log('\n📊 Kết quả migrate:');
        console.log(`✅ Thành công: ${successCount}`);
        console.log(`❌ Lỗi: ${errorCount}`);
        console.log(`📈 Tổng cộng: ${users.length}`);
        
        if (successCount > 0) {
            console.log('\n🎉 Migrate mật khẩu hoàn thành!');
        } else {
            console.log('\nℹ️ Không có mật khẩu nào cần migrate');
        }
        
    } catch (error) {
        console.error('❌ Lỗi khi migrate passwords:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Chạy migration
migratePasswords(); 