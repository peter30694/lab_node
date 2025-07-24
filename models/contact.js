const { getDb } = require('../util/database');
const { ObjectId } = require('mongodb');

class Contact {
    constructor(data) {
        // Validate required fields
        this.validateContactData(data);
        
        this.email = this.validateEmail(data.email);
        this.name = data.name ? this.validateName(data.name) : null;
        this.phone = data.phone ? this.validatePhone(data.phone) : null;
        this.subject = data.subject ? this.validateSubject(data.subject) : null;
        this.message = data.message ? this.validateMessage(data.message) : null;
        this.type = this.validateType(data.type);
        this.status = data.status || 'pending';
        this.adminNotes = data.adminNotes || null;
        this.replyMessage = data.replyMessage || null;
        this.replyDate = data.replyDate || null;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    validateContactData(data) {
        if (!data.email) {
            throw new Error('Email là bắt buộc');
        }
        if (!data.type) {
            throw new Error('Loại liên hệ là bắt buộc');
        }
        if (data.type === 'contact' && !data.message) {
            throw new Error('Nội dung tin nhắn là bắt buộc cho liên hệ');
        }
    }

    validateEmail(email) {
        const trimmedEmail = email.trim().toLowerCase();
        
        // Kiểm tra format email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(trimmedEmail)) {
            throw new Error('Email không hợp lệ');
        }
        
        // Kiểm tra độ dài
        if (trimmedEmail.length > 100) {
            throw new Error('Email không được vượt quá 100 ký tự');
        }
        
        return trimmedEmail;
    }

    validateName(name) {
        const trimmedName = name.trim();
        
        // Kiểm tra độ dài
        if (trimmedName.length < 2 || trimmedName.length > 50) {
            throw new Error('Tên phải từ 2-50 ký tự');
        }
        
        // Kiểm tra ký tự đặc biệt
        const nameRegex = /^[a-zA-ZÀ-ỹ\s]+$/;
        if (!nameRegex.test(trimmedName)) {
            throw new Error('Tên chỉ được chứa chữ cái và khoảng trắng');
        }
        
        return trimmedName;
    }

    validatePhone(phone) {
        const cleanPhone = phone.replace(/\s/g, '');
        
        // Kiểm tra format số điện thoại Việt Nam
        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(cleanPhone)) {
            throw new Error('Số điện thoại phải có 10-11 chữ số');
        }
        
        return cleanPhone;
    }

    validateSubject(subject) {
        const trimmedSubject = subject.trim();
        
        // Kiểm tra độ dài
        if (trimmedSubject.length < 5 || trimmedSubject.length > 100) {
            throw new Error('Chủ đề phải từ 5-100 ký tự');
        }
        
        // Kiểm tra ký tự đặc biệt
        const subjectRegex = /^[a-zA-ZÀ-ỹ0-9\s\-_.,!?()]+$/;
        if (!subjectRegex.test(trimmedSubject)) {
            throw new Error('Chủ đề chứa ký tự không hợp lệ');
        }
        
        return trimmedSubject;
    }

    validateMessage(message) {
        const trimmedMessage = message.trim();
        
        // Kiểm tra độ dài
        if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
            throw new Error('Nội dung tin nhắn phải từ 10-2000 ký tự');
        }
        
        // Kiểm tra spam keywords
        const spamKeywords = ['casino', 'viagra', 'loan', 'credit', 'debt', 'make money fast'];
        const lowerMessage = trimmedMessage.toLowerCase();
        for (const keyword of spamKeywords) {
            if (lowerMessage.includes(keyword)) {
                throw new Error('Nội dung tin nhắn chứa từ khóa không hợp lệ');
            }
        }
        
        return trimmedMessage;
    }

    validateType(type) {
        const validTypes = ['contact', 'newsletter'];
        if (!validTypes.includes(type)) {
            throw new Error('Loại liên hệ không hợp lệ');
        }
        return type;
    }

    async save() {
        try {
            const db = getDb();
            
            if (this.type === 'newsletter') {
                // Kiểm tra email đã tồn tại chưa
                const existing = await db.collection('contacts').findOne({ 
                    email: this.email, 
                    type: 'newsletter' 
                });
                
                if (existing) {
                    // Cập nhật nếu đã tồn tại
                    await db.collection('contacts').updateOne(
                        { email: this.email, type: 'newsletter' },
                        { 
                            $set: { 
                                status: 'pending',
                                updatedAt: new Date() 
                            } 
                        }
                    );
                    return { ...existing, status: 'pending', updatedAt: new Date() };
                }
            }

            const result = await db.collection('contacts').insertOne(this);
            return { ...this, _id: result.insertedId };
        } catch (error) {
            throw error;
        }
    }

    static async findAll(options = {}) {
        const db = getDb();
        const { type, status, limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
        
        const filter = {};
        if (type) filter.type = type;
        if (status) filter.status = status;

        const contacts = await db.collection('contacts')
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();

        return contacts;
    }
    
    static async findWithPagination(filter = {}, sort = {}, skip = 0, limit = 10) {
        const db = getDb();
        return await db.collection('contacts')
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();
    }
    
    static async countDocuments(filter = {}) {
        const db = getDb();
        return await db.collection('contacts').countDocuments(filter);
    }

    static async findById(id) {
        const db = getDb();
        return await db.collection('contacts').findOne({ _id: new ObjectId(id) });
    }

    static async findByEmail(email, type = null) {
        const db = getDb();
        const filter = { email: email };
        if (type) filter.type = type;
        return await db.collection('contacts').findOne(filter);
    }

    static async updateStatus(id, status, adminNotes = null) {
        const db = getDb();
        const updateData = { 
            status: status, 
            updatedAt: new Date() 
        };
        
        if (adminNotes !== null) {
            updateData.adminNotes = adminNotes;
        }
        
        const result = await db.collection('contacts').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        return result;
    }

    static async replyToContact(id, replyMessage) {
        const db = getDb();
        const result = await db.collection('contacts').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    status: 'replied',
                    replyMessage: replyMessage,
                    replyDate: new Date(),
                    updatedAt: new Date() 
                } 
            }
        );
        return result;
    }

    static async delete(id) {
        const db = getDb();
        return await db.collection('contacts').deleteOne({ _id: new ObjectId(id) });
    }

    // Newsletter specific methods
    static async findAllNewsletterSubscribers() {
        return await this.findAll({ type: 'newsletter', status: 'approved' });
    }

    static async findAllPendingNewsletters() {
        return await this.findAll({ type: 'newsletter', status: 'pending' });
    }

    static async approveNewsletter(id, adminNotes = null) {
        return await this.updateStatus(id, 'approved', adminNotes);
    }

    static async rejectNewsletter(id, adminNotes = null) {
        return await this.updateStatus(id, 'rejected', adminNotes);
    }

    static async unsubscribe(email) {
        const db = getDb();
        const result = await db.collection('contacts').updateOne(
            { email: email, type: 'newsletter' },
            { 
                $set: { 
                    status: 'unsubscribed', 
                    updatedAt: new Date() 
                } 
            }
        );
        return result;
    }

    static async getNewsletterSubscriberCount() {
        const db = getDb();
        return await db.collection('contacts').countDocuments({ 
            type: 'newsletter', 
            status: 'approved' 
        });
    }

    // Contact specific methods
    static async findAllContacts() {
        return await this.findAll({ type: 'contact' });
    }

    static async findAllPendingContacts() {
        return await this.findAll({ type: 'contact', status: 'pending' });
    }

    static async getContactCount() {
        const db = getDb();
        return await db.collection('contacts').countDocuments({ type: 'contact' });
    }

    // Analytics methods
    static async getContactStats() {
        const db = getDb();
        
        const stats = await db.collection('contacts').aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    pendingCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
                        }
                    },
                    approvedCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'approved'] }, 1, 0]
                        }
                    },
                    repliedCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'replied'] }, 1, 0]
                        }
                    },
                    rejectedCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
                        }
                    }
                }
            }
        ]).toArray();

        const result = {
            totalContacts: 0,
            totalNewsletter: 0,
            pendingContacts: 0,
            pendingNewsletters: 0,
            approvedNewsletters: 0,
            repliedContacts: 0
        };

        stats.forEach(stat => {
            if (stat._id === 'newsletter') {
                result.totalNewsletter = stat.count;
                result.pendingNewsletters = stat.pendingCount;
                result.approvedNewsletters = stat.approvedCount;
            } else if (stat._id === 'contact') {
                result.totalContacts = stat.count;
                result.pendingContacts = stat.pendingCount;
                result.repliedContacts = stat.repliedCount;
            }
        });

        return result;
    }

    static async getRecentContacts(limit = 10) {
        return await this.findAll({ 
            type: 'contact', 
            limit: limit, 
            sort: { createdAt: -1 } 
        });
    }

    static async getContactByDateRange(startDate, endDate) {
        const db = getDb();
        return await db.collection('contacts').find({
            type: 'contact',
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ createdAt: -1 }).toArray();
    }

    // Export methods
    static async exportContacts(format = 'json') {
        const contacts = await this.findAll({ type: 'contact' });
        
        if (format === 'csv') {
            const csv = [
                'Email,Name,Phone,Subject,Message,Status,AdminNotes,ReplyMessage,ReplyDate,CreatedAt',
                ...contacts.map(contact => 
                    `"${contact.email}","${contact.name || ''}","${contact.phone || ''}","${contact.subject || ''}","${contact.message || ''}","${contact.status}","${contact.adminNotes || ''}","${contact.replyMessage || ''}","${contact.replyDate || ''}","${contact.createdAt}"`
                )
            ].join('\n');
            return csv;
        }
        
        return contacts;
    }

    static async exportNewsletterSubscribers(format = 'json') {
        const subscribers = await this.findAll({ type: 'newsletter', status: 'approved' });
        
        if (format === 'csv') {
            const csv = [
                'Email,Status,AdminNotes,CreatedAt',
                ...subscribers.map(sub => 
                    `"${sub.email}","${sub.status}","${sub.adminNotes || ''}","${sub.createdAt}"`
                )
            ].join('\n');
            return csv;
        }
        
        return subscribers;
    }
    
    static async exportAllContacts(format = 'json') {
        const contacts = await this.findAll();
        
        if (format === 'csv') {
            const csv = [
                'Email,Name,Phone,Type,Subject,Message,Status,AdminNotes,ReplyMessage,ReplyDate,CreatedAt',
                ...contacts.map(contact => 
                    `"${contact.email}","${contact.name || ''}","${contact.phone || ''}","${contact.type}","${contact.subject || ''}","${contact.message || ''}","${contact.status}","${contact.adminNotes || ''}","${contact.replyMessage || ''}","${contact.replyDate || ''}","${contact.createdAt}"`
                )
            ].join('\n');
            return csv;
        }
        
        return contacts;
    }

    // Kiểm tra spam và rate limiting
    static async checkSpamAndRateLimit(email, type, ipAddress = null) {
        try {
            const db = getDb();
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // Kiểm tra rate limit theo email
            const emailCount = await db.collection('contacts').countDocuments({
                email: email,
                type: type,
                createdAt: { $gte: oneHourAgo }
            });
            
            if (emailCount >= 5) {
                return {
                    allowed: false,
                    message: 'Bạn đã gửi quá nhiều tin nhắn trong 1 giờ qua'
                };
            }
            
            // Kiểm tra rate limit theo IP (nếu có)
            if (ipAddress) {
                const ipCount = await db.collection('contacts').countDocuments({
                    ipAddress: ipAddress,
                    type: type,
                    createdAt: { $gte: oneHourAgo }
                });
                
                if (ipCount >= 10) {
                    return {
                        allowed: false,
                        message: 'Quá nhiều yêu cầu từ IP này'
                    };
                }
            }
            
            // Kiểm tra spam theo nội dung
            const recentContacts = await db.collection('contacts').find({
                email: email,
                type: type,
                createdAt: { $gte: oneDayAgo }
            }).toArray();
            
            if (recentContacts.length > 0) {
                const lastContact = recentContacts[0];
                const timeDiff = now.getTime() - lastContact.createdAt.getTime();
                
                if (timeDiff < 60000) { // 1 phút
                    return {
                        allowed: false,
                        message: 'Vui lòng đợi 1 phút trước khi gửi tin nhắn tiếp theo'
                    };
                }
            }
            
            return {
                allowed: true,
                message: 'OK'
            };
        } catch (err) {
            console.error('Lỗi khi kiểm tra spam và rate limit:', err);
            throw err;
        }
    }
}

module.exports = Contact; 