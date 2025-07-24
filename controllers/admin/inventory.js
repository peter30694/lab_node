const Product = require('../../models/product');
const Category = require('../../models/category');
const { getDb } = require('../../util/database');
const { ObjectId } = require('mongodb');
const { generateInventoryPDF } = require('../../util/pdf-generator');


function getStockStatus(stockQuantity) {
    if (stockQuantity > 10) {
        return { status: 'in_stock', label: 'Còn hàng', color: 'green' };
    } else if (stockQuantity > 0) {
        return { status: 'low_stock', label: 'Sắp hết hàng', color: 'yellow' };
    } else {
        return { status: 'out_of_stock', label: 'Hết hàng', color: 'red' };
    }
}

exports.getInventory = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Không có quyền truy cập',
                path: '/error',
                message: 'Bạn không có quyền truy cập trang này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: false
            });
        }

        const search = req.query.search || '';
        const category = req.query.category || '';
        const stockFilter = req.query.stock || '';
        const sort = req.query.sort || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // Build filter object for server-side search
        let filter = {};
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { category: searchRegex }
            ];
        }
        if (category && category.trim()) {
            filter.category = category.trim();
        }
        if (stockFilter) {
            switch (stockFilter) {
                case 'in_stock':
                    filter.stockQuantity = { $gt: 0 };
                    break;
                case 'out_of_stock':
                    filter.stockQuantity = { $lte: 0 };
                    break;
                case 'low_stock':
                    filter.stockQuantity = { $gt: 0, $lte: 10 };
                    break;
            }
        }

        // Build sort object for server-side sorting
        let sortObject = { updatedAt: -1 }; // Default sort
        if (sort) {
            switch (sort) {
                case 'name_asc':
                    sortObject = { title: 1 };
                    break;
                case 'name_desc':
                    sortObject = { title: -1 };
                    break;
                case 'stock_asc':
                    sortObject = { stockQuantity: 1 };
                    break;
                case 'stock_desc':
                    sortObject = { stockQuantity: -1 };
                    break;
                case 'price_asc':
                    sortObject = { price: 1 };
                    break;
                case 'price_desc':
                    sortObject = { price: -1 };
                    break;
                default:
                    sortObject = { updatedAt: -1 };
            }
        }

        // Get total count for pagination
        const db = getDb();
        const totalProducts = await db.collection('products').countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);
        
        // Get products with server-side pagination and sorting
        const skip = (page - 1) * limit;
        const products = await db.collection('products')
            .find(filter)
            .sort(sortObject)
            .skip(skip)
            .limit(limit)
            .toArray();
        
        console.log('Server-side inventory search results:', {
            search,
            category,
            stockFilter,
            sort,
            totalProducts,
            currentPage: page,
            resultsCount: products.length
        });

        // Pagination logic (already calculated above)
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = products; // Already paginated from database

        // Calculate pagination info
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        const nextPage = hasNextPage ? page + 1 : null;
        const prevPage = hasPrevPage ? page - 1 : null;

        // Generate page numbers for pagination
        const pageNumbers = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }

        // Get categories for filter dropdown
        const categories = await Category.find();

        // Calculate inventory statistics
        const totalItems = products.length;
        const inStockItems = products.filter(p => p.stockQuantity > 10).length;
        const outOfStockItems = products.filter(p => !p.stockQuantity || p.stockQuantity === 0).length;
        const lowStockItems = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 10).length;
        const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stockQuantity), 0);

        res.render('admin/inventory', {
            pageTitle: 'Quản lý kho sản phẩm',
            path: '/admin/inventory',
            products: paginatedProducts,
            categories,
            search,
            category,
            stockFilter,
            sort,
            page,
            limit,
            totalProducts,
            totalPages,
            hasNextPage,
            hasPrevPage,
            nextPage,
            prevPage,
            pageNumbers,
            // Statistics
            totalItems,
            inStockItems,
            outOfStockItems,
            lowStockItems,
            totalStockValue,
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Lỗi khi tải trang quản lý kho:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải trang quản lý kho',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.updateStockQuantity = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện thao tác này'
            });
        }

        const { productId, quantity, action } = req.body;

        if (!productId || quantity === undefined || quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ'
            });
        }

        const db = getDb();
        const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm'
            });
        }

        let newQuantity;
        switch (action) {
            case 'set':
                newQuantity = parseInt(quantity);
                break;
            case 'add':
                newQuantity = product.stockQuantity + parseInt(quantity);
                break;
            case 'subtract':
                newQuantity = Math.max(0, product.stockQuantity - parseInt(quantity));
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Hành động không hợp lệ'
                });
        }

        // Kiểm tra tồn kho không được âm
        if (newQuantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Số lượng tồn kho không thể âm'
            });
        }

        // Cập nhật số lượng tồn kho với validation
        const result = await db.collection('products').findOneAndUpdate(
            { _id: new ObjectId(productId) },
            { 
                $set: { 
                    stockQuantity: newQuantity,
                    updatedAt: new Date()
                } 
            },
            { 
                returnDocument: 'after',
                projection: { title: 1, stockQuantity: 1, price: 1 }
            }
        );

        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm để cập nhật'
            });
        }

        // Log hoạt động cập nhật tồn kho
        console.log(`📦 Admin cập nhật tồn kho: ${result.value.title} - ${action} ${quantity} = ${result.value.stockQuantity}`);

        res.json({
            success: true,
            message: 'Cập nhật số lượng tồn kho thành công',
            product: {
                _id: result.value._id,
                title: result.value.title,
                stockQuantity: result.value.stockQuantity,
                price: result.value.price,
                stockStatus: getStockStatus(result.value.stockQuantity)
            }
        });

    } catch (err) {
        console.error('❌ Lỗi khi cập nhật số lượng tồn kho:', err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật số lượng tồn kho'
        });
    }
};

exports.bulkUpdateStock = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện thao tác này'
            });
        }

        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ'
            });
        }

        const db = getDb();
        const session = db.client.startSession();
        const results = [];

        try {
            await session.withTransaction(async () => {
                for (const update of updates) {
                    const { productId, quantity, action } = update;

                    if (!productId || quantity === undefined || quantity < 0) {
                        results.push({
                            productId,
                            success: false,
                            message: 'Dữ liệu không hợp lệ'
                        });
                        continue;
                    }

                    try {
                        const product = await db.collection('products').findOne(
                            { _id: new ObjectId(productId) },
                            { session }
                        );

                        if (!product) {
                            results.push({
                                productId,
                                success: false,
                                message: 'Không tìm thấy sản phẩm'
                            });
                            continue;
                        }

                        let newQuantity;
                        switch (action) {
                            case 'set':
                                newQuantity = parseInt(quantity);
                                break;
                            case 'add':
                                newQuantity = product.stockQuantity + parseInt(quantity);
                                break;
                            case 'subtract':
                                newQuantity = Math.max(0, product.stockQuantity - parseInt(quantity));
                                break;
                            default:
                                results.push({
                                    productId,
                                    success: false,
                                    message: 'Hành động không hợp lệ'
                                });
                                continue;
                        }

                        // Kiểm tra tồn kho không được âm
                        if (newQuantity < 0) {
                            results.push({
                                productId,
                                success: false,
                                message: 'Số lượng tồn kho không thể âm'
                            });
                            continue;
                        }

                        const result = await db.collection('products').findOneAndUpdate(
                            { _id: new ObjectId(productId) },
                            { 
                                $set: { 
                                    stockQuantity: newQuantity,
                                    updatedAt: new Date()
                                } 
                            },
                            { 
                                returnDocument: 'after',
                                session,
                                projection: { title: 1, stockQuantity: 1, price: 1 }
                            }
                        );

                        if (!result.value) {
                            results.push({
                                productId,
                                success: false,
                                message: 'Không thể cập nhật sản phẩm'
                            });
                            continue;
                        }

                        console.log(`📦 Bulk update: ${result.value.title} - ${action} ${quantity} = ${result.value.stockQuantity}`);

                        results.push({
                            productId,
                            success: true,
                            message: 'Cập nhật thành công',
                            oldQuantity: product.stockQuantity,
                            newQuantity: newQuantity,
                            product: {
                                title: result.value.title,
                                stockQuantity: result.value.stockQuantity,
                                price: result.value.price,
                                stockStatus: getStockStatus(result.value.stockQuantity)
                            }
                        });

                    } catch (error) {
                        console.error(`❌ Lỗi khi cập nhật sản phẩm ${productId}:`, error);
                        results.push({
                            productId,
                            success: false,
                            message: 'Lỗi khi cập nhật sản phẩm'
                        });
                    }
                }
            });
        } finally {
            await session.endSession();
        }

        res.json({
            success: true,
            message: 'Cập nhật hàng loạt hoàn tất',
            results: results
        });

    } catch (err) {
        console.error('❌ Lỗi khi cập nhật hàng loạt tồn kho:', err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật hàng loạt tồn kho'
        });
    }
};

exports.exportInventoryReport = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Không có quyền truy cập',
                path: '/error',
                message: 'Bạn không có quyền truy cập trang này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: false
            });
        }

        const stockFilter = req.query.stock || '';

        // Build filter object
        let filter = {};
        if (stockFilter) {
            switch (stockFilter) {
                case 'in_stock':
                    filter.stockQuantity = { $gt: 0 };
                    break;
                case 'out_of_stock':
                    filter.stockQuantity = { $lte: 0 };
                    break;
                case 'low_stock':
                    filter.stockQuantity = { $gt: 0, $lte: 10 };
                    break;
            }
        }

        const products = await Product.find(filter);
        const categories = await Category.find();

        // Calculate statistics
        const totalItems = products.length;
        const inStockItems = products.filter(p => p.stockQuantity > 10).length;
        const outOfStockItems = products.filter(p => !p.stockQuantity || p.stockQuantity === 0).length;
        const lowStockItems = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 10).length;
        const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stockQuantity), 0);

        // Generate PDF report
        const pdfBuffer = await generateInventoryPDF(products, categories, {
            totalItems,
            inStockItems,
            outOfStockItems,
            lowStockItems,
            totalStockValue,
            stockFilter
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Lỗi khi xuất báo cáo kho:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể xuất báo cáo kho',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
}; 