const mongodb = require('mongodb');
const getDb = require('../util/database').getDb;

class Service {
    constructor(name, description, fullDescription, price, duration, imageUrl, category = 'general', status = 'active') {
        this.name = name;
        this.description = description;
        this.fullDescription = fullDescription;
        this.price = parseFloat(price);
        this.duration = duration; // in minutes
        this.imageUrl = imageUrl;
        this.category = category;
        this.status = status; // active, inactive
        this.bookings = 0;
        this.rating = 0;
        this.reviews = [];
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    async save() {
        try {
            const db = getDb();
            let result;
            
            if (this._id) {
                // Update existing service
                this.updatedAt = new Date();
                result = await db.collection('services').updateOne(
                    { _id: this._id },
                    { $set: this }
                );
            } else {
                // Create new service
                result = await db.collection('services').insertOne(this);
            }
            
            return result;
        } catch (err) {
            console.error('Lỗi khi lưu dịch vụ:', err);
            throw err;
        }
    }

    static async fetchAll(limit = 10, page = 1, category = null, status = 'active', sort = null, search = null) {
        try {
            const db = getDb();
            const skip = (page - 1) * limit;
            let filter = {};
            if (status) {
                filter.status = status;
            }
            if (category && category !== 'all') {
                filter.category = category;
            }
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                filter.$or = [
                    { name: searchRegex },
                    { description: searchRegex }
                ];
            }
            // Build sort object
            let sortObject = { createdAt: -1 };
            if (sort) {
                switch (sort) {
                    case 'name_asc':
                        sortObject = { name: 1 };
                        break;
                    case 'name_desc':
                        sortObject = { name: -1 };
                        break;
                    case 'price_asc':
                        sortObject = { price: 1 };
                        break;
                    case 'price_desc':
                        sortObject = { price: -1 };
                        break;
                    case 'rating_desc':
                        sortObject = { rating: -1 };
                        break;
                    case 'bookings_desc':
                        sortObject = { bookings: -1 };
                        break;
                    default:
                        sortObject = { createdAt: -1 };
                }
            }
            const services = await db.collection('services')
                .find(filter)
                .sort(sortObject)
                .skip(skip)
                .limit(limit)
                .toArray();
            const total = await db.collection('services').countDocuments(filter);
            const totalPages = Math.ceil(total / limit) || 1;
            const hasPrevPage = page > 1;
            const hasNextPage = page < totalPages;
            const prevPage = hasPrevPage ? page - 1 : null;
            const nextPage = hasNextPage ? page + 1 : null;
            let startPage = Math.max(1, page - 2);
            let endPage = Math.min(totalPages, page + 2);
            if (endPage - startPage < 4) {
                if (startPage === 1) endPage = Math.min(5, totalPages);
                if (endPage === totalPages) startPage = Math.max(1, totalPages - 4);
            }
            const pageNumbers = [];
            for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
            return {
                services,
                total,
                totalPages,
                currentPage: page,
                hasPrevPage,
                hasNextPage,
                prevPage,
                nextPage,
                pageNumbers,
                limit,
                totalServices: total
            };
        } catch (err) {
            console.error('Lỗi khi lấy danh sách dịch vụ:', err);
            throw err;
        }
    }

    static async findById(serviceId) {
        try {
            const db = getDb();
            const service = await db.collection('services')
                .findOne({ _id: new mongodb.ObjectId(serviceId) });
            return service;
        } catch (err) {
            console.error('Lỗi khi tìm dịch vụ:', err);
            throw err;
        }
    }

    static async updateById(serviceId, updateData) {
        try {
            const db = getDb();
            updateData.updatedAt = new Date();
            return await db.collection('services').updateOne(
                { _id: new mongodb.ObjectId(serviceId) },
                { $set: updateData }
            );
        } catch (err) {
            console.error('Lỗi khi cập nhật dịch vụ:', err);
            throw err;
        }
    }

    static async deleteById(serviceId) {
        try {
            const db = getDb();
            const result = await db.collection('services')
                .deleteOne({ _id: new mongodb.ObjectId(serviceId) });
            return result;
        } catch (err) {
            console.error('Lỗi khi xóa dịch vụ:', err);
            throw err;
        }
    }

    static async getFeaturedServices(limit = 6) {
        try {
            const db = getDb();
            const services = await db.collection('services')
                .find({ status: 'active' })
                .sort({ bookings: -1, rating: -1 })
                .limit(limit)
                .toArray();
            return services;
        } catch (err) {
            console.error('Lỗi khi lấy dịch vụ nổi bật:', err);
            throw err;
        }
    }
}

module.exports = Service;