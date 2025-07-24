const { validationResult } = require('express-validator');
const Product = require('../../models/product');
const Category = require('../../models/category');
const { getDb } = require('../../util/database');
const { fixVietnameseTextForDB } = require('../../util/text-helper'); 
const { generateProductsPDF } = require('../../util/pdf');
const fs = require('fs');
const path = require('path');


exports.getAddProduct = async (req, res, next) => {
    try {
        const categories = await Category.find();
        res.render('admin/add-product', {
            pageTitle: 'Thêm sản phẩm',
            path: '/admin/add-product',
            editing: false,
            categories,
            product: {
                title: '',
                price: '',
                description: '',
                imageUrl: ''
            },
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    } catch (err) {
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải danh mục',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
    }
};

exports.postAddProduct = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Bạn không có quyền thực hiện thao tác này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        const { title, price, description, stockQuantity, category, origin } = req.body;
        const imageUrl = req.file ? '/images/products/' + req.file.filename : null;

        if (!imageUrl) {
            const categories = await Category.find();
            return res.status(400).render('admin/add-product', {
                pageTitle: 'Thêm sản phẩm',
                path: '/admin/add-product',
                editing: false,
                categories,
                product: {
                    title: title || '',
                    price: price || '',
                    description: description || '',
                    imageUrl: ''
                },
                errorMessage: 'Vui lòng tải lên hình ảnh sản phẩm',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin',
                user: req.session.user || null
            });
        }

        // Fix Vietnamese text encoding before saving
        const fixedTitle = fixVietnameseTextForDB(title);
        const fixedDescription = fixVietnameseTextForDB(description);
        const fixedCategory = fixVietnameseTextForDB(category);

        const product = new Product(
            null,
            fixedTitle,
            imageUrl,
            fixedDescription,
            parseFloat(price),
            parseInt(stockQuantity),
            fixedCategory,
            origin
        );

        await product.save();
        res.redirect('/admin/products');
    } catch (err) {
        console.error('Lỗi khi thêm sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể thêm sản phẩm mới',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getProducts = async (req, res, next) => {
    try {
        console.log('=== getProducts called ===');
        console.log('URL:', req.url);
        console.log('Method:', req.method);
        console.log('Query params:', req.query);
        console.log('Session user:', req.session.user);
        
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            console.log('User not admin, redirecting to error page');
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
        const sort = req.query.sort || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Số sản phẩm mỗi trang
        
        console.log('Filter params:', { search, category, sort, page, limit });

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

        // Thêm filter trạng thái tồn kho
        if (req.query.stock) {
            switch (req.query.stock) {
                case 'low_stock':
                    filter.stockQuantity = { $gt: 0, $lte: 10 };
                    break;
                case 'out_of_stock':
                    filter.stockQuantity = { $lte: 0 };
                    break;
            }
        }

        // Build sort object for server-side sorting
        let sortObject = { createdAt: -1 }; // Default sort
        if (sort) {
            switch (sort) {
                case 'name_asc':
                    sortObject = { title: 1 };
                    break;
                case 'name_desc':
                    sortObject = { title: -1 };
                    break;
                case 'price_asc':
                    sortObject = { price: 1 };
                    break;
                case 'price_desc':
                    sortObject = { price: -1 };
                    break;
                case 'stock_asc':
                    sortObject = { stockQuantity: 1 };
                    break;
                case 'stock_desc':
                    sortObject = { stockQuantity: -1 };
                    break;
                default:
                    sortObject = { createdAt: -1 };
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
        
        console.log('Server-side search results:', {
            search,
            category,
            sort,
            totalProducts,
            currentPage: page,
            resultsCount: products.length
        });

        // Pagination logic (already calculated above)
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        // Products are already paginated from database query
        const paginatedProducts = products;
        
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
        const categories = [
            { slug: 'dog', name: 'Chó cưng', icon: '🐶' },
            { slug: 'cat', name: 'Mèo cưng', icon: '🐱' },
            { slug: 'fish', name: 'Cá cảnh', icon: '🐟' },
            { slug: 'small-pets', name: 'Thú nhỏ', icon: '🐹' }
        ];

        console.log('Rendering admin/products with data:', {
            productsCount: paginatedProducts ? paginatedProducts.length : 0,
            totalProducts,
            totalPages,
            currentPage: page,
            categoriesCount: categories ? categories.length : 0,
            search,
            category,
            sort
        });
        
        res.render('admin/products', {
            prods: paginatedProducts || [],
            categories,
            search,
            category,
            sort,
            stock: req.query.stock || '',
            // Pagination data
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                hasNextPage,
                hasPrevPage,
                nextPage,
                prevPage,
                pageNumbers,
                limit
            },
            query: { search, category, sort, limit },
            pageTitle: 'Quản lý sản phẩm',
            path: '/admin/products',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin',
            user: req.session.user || null
        });
        
        console.log('=== getProducts completed successfully ===');
    } catch (err) {
        console.error('Lỗi khi lấy danh sách sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải danh sách sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.getEditProduct = async (req, res, next) => {
    const editMode = req.query.edit;
    if (!editMode) {
        return res.redirect('/');
    }

    const prodId = req.params.productId;
    try {
        const product = await Product.findById(prodId);
        if (!product) {
            return res.redirect('/');
        }

        res.render('admin/edit-product', {
            pageTitle: 'Chỉnh sửa sản phẩm',
            path: '/admin/edit-product',
            editing: editMode,
            product: product
        });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể tải thông tin sản phẩm'
        });
    }
};

exports.postEditProduct = async (req, res, next) => {
    try {
        // Kiểm tra quyền admin
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).render('error/403', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Bạn không có quyền thực hiện thao tác này',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        const prodId = req.body.productId;
        const updatedTitle = req.body.title;
        const updatedPrice = parseFloat(req.body.price);
        const updatedDesc = req.body.description;
        const updatedStockQuantity = parseInt(req.body.stockQuantity);
        const updatedCategory = req.body.category;
        const updatedOrigin = req.body.origin;

        // Lấy sản phẩm hiện tại để giữ lại imageUrl nếu không upload file mới
        const currentProduct = await Product.findById(prodId);
        if (!currentProduct) {
            return res.status(404).render('error/404', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Không tìm thấy sản phẩm',
                isAuthenticated: req.session.user ? true : false,
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Nếu có file mới thì sử dụng file mới, không thì giữ file cũ
        let updatedImageUrl = currentProduct.imageUrl;
        if (req.file) {
            // Nếu có file ảnh mới, xóa file ảnh cũ
            if (currentProduct.imageUrl) {
                const oldImagePath = path.join(__dirname, '..', 'public', currentProduct.imageUrl);
                // Kiểm tra file tồn tại trước khi xóa
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) {
                            console.error('Lỗi khi xóa ảnh cũ:', err);
                        }
                    });
                }
            }
            updatedImageUrl = '/public/images/products/' + req.file.filename;
        }

        // Fix Vietnamese text encoding before saving
        const fixedTitle = fixVietnameseTextForDB(updatedTitle);
        const fixedDescription = fixVietnameseTextForDB(updatedDesc);
        const fixedCategory = fixVietnameseTextForDB(updatedCategory);

        const product = new Product(
            prodId,
            fixedTitle,
            updatedImageUrl,
            fixedDescription,
            updatedPrice,
            updatedStockQuantity,
            fixedCategory,
            updatedOrigin
        );

        await product.save();
        res.redirect('/admin/products');
    } catch (err) {
        console.error('Lỗi khi cập nhật sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể cập nhật sản phẩm',
            isAuthenticated: req.session.user ? true : false,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
};

exports.postDeleteProduct = async (req, res, next) => {
    try {
        const prodId = req.body.productId;
        await Product.deleteById(prodId);
        res.redirect('/admin/products');
    } catch (err) {
        console.error('Lỗi khi xóa sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể xóa sản phẩm'
        });
    }
};

exports.getExportProductsPDF = async (req, res, next) => {
    try {
        console.log('Bắt đầu xuất PDF danh sách sản phẩm');

        // Lấy danh sách sản phẩm với điều kiện lọc
        const { category, minPrice, maxPrice, sortBy } = req.query;
        let products = await Product.fetchAll();

        if (!products) {
            console.error('Không thể lấy danh sách sản phẩm');
            return res.status(500).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Không thể lấy danh sách sản phẩm'
            });
        }

        // Áp dụng bộ lọc nếu có
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (minPrice) {
            products = products.filter(p => p.price >= parseFloat(minPrice));
        }
        if (maxPrice) {
            products = products.filter(p => p.price <= parseFloat(maxPrice));
        }

        // Sắp xếp sản phẩm
        if (sortBy) {
            switch (sortBy) {
                case 'price-asc':
                    products.sort((a, b) => (a.price || 0) - (b.price || 0));
                    break;
                case 'price-desc':
                    products.sort((a, b) => (b.price || 0) - (a.price || 0));
                    break;
                case 'name-asc':
                    products.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                    break;
                case 'name-desc':
                    products.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                    break;
            }
        }

        console.log(`Đã lấy được ${products.length} sản phẩm`);

        if (products.length === 0) {
            console.log('Không có sản phẩm nào để xuất PDF');
            return res.status(404).render('error/404', {
                pageTitle: 'Không có sản phẩm',
                path: '/error',
                message: 'Không có sản phẩm nào phù hợp với tiêu chí tìm kiếm'
            });
        }

        // Tạo PDF
        console.log('Đang tạo PDF...');
        const pdfPath = await generateProductsPDF(products);
        console.log('Đã tạo PDF thành công tại:', pdfPath);

        // Kiểm tra file có tồn tại không
        if (!fs.existsSync(pdfPath)) {
            console.error('File PDF không tồn tại sau khi tạo:', pdfPath);
            return res.status(500).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Không thể tạo file PDF'
            });
        }

        // Gửi file PDF về client
        console.log('Đang gửi file PDF về client...');
        const fileName = `products-list-${new Date().toISOString().slice(0, 10)}.pdf`;
        res.download(pdfPath, fileName, (err) => {
            if (err) {
                console.error('Lỗi khi tải file PDF:', err);
                return res.status(500).render('error/500', {
                    pageTitle: 'Lỗi',
                    path: '/error',
                    message: 'Không thể tải xuống file PDF: ' + err.message
                });
            }
            console.log('Đã gửi file PDF thành công');

            // Xóa file sau khi đã gửi
            try {
                fs.unlink(pdfPath, (err) => {
                    if (err) {
                        console.error('Lỗi khi xóa file PDF:', err);
                    } else {
                        console.log('Đã xóa file PDF tạm thời');
                    }
                });
            } catch (unlinkErr) {
                console.error('Lỗi khi xóa file PDF:', unlinkErr);
            }
        });
    } catch (err) {
        console.error('Lỗi khi xuất PDF danh sách sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể xuất PDF danh sách sản phẩm: ' + err.message
        });
    }
};

exports.getExportProducts = async (req, res, next) => {
    try {
        console.log('Bắt đầu xuất Excel danh sách sản phẩm');

        // Lấy danh sách sản phẩm với điều kiện lọc
        const { search, category, sort } = req.query;
        let filter = {};
        
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) {
            filter.category = category;
        }

        let products = await Product.find(filter);

        if (!products) {
            console.error('Không thể lấy danh sách sản phẩm');
            return res.status(500).render('error/500', {
                pageTitle: 'Lỗi',
                path: '/error',
                message: 'Không thể lấy danh sách sản phẩm'
            });
        }

        // Sắp xếp sản phẩm
        if (sort) {
            switch (sort) {
                case 'name_asc':
                    products.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'name_desc':
                    products.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case 'price_asc':
                    products.sort((a, b) => a.price - b.price);
                    break;
                case 'price_desc':
                    products.sort((a, b) => b.price - a.price);
                    break;
                case 'stock_asc':
                    products.sort((a, b) => a.stockQuantity - b.stockQuantity);
                    break;
                case 'stock_desc':
                    products.sort((a, b) => b.stockQuantity - a.stockQuantity);
                    break;
                default:
                    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        }

        // Tạo CSV content
        const categories = {
            'dog': 'Chó cưng',
            'cat': 'Mèo cưng', 
            'fish': 'Cá cảnh',
            'small-pets': 'Thú nhỏ'
        };

        let csvContent = 'Tên sản phẩm,Danh mục,Giá (VNĐ),Mô tả,Tồn kho,Ngày tạo\n';
        
        products.forEach(product => {
            const categoryName = categories[product.category] || product.category || 'Chưa phân loại';
            const price = (product.price || 0).toLocaleString('vi-VN');
            const description = (product.description || '').replace(/"/g, '""'); // Escape quotes
            const stock = product.stockQuantity || 0;
            const createdAt = new Date(product.createdAt).toLocaleDateString('vi-VN');
            
            csvContent += `"${product.title}","${categoryName}","${price}","${description}","${stock}","${createdAt}"\n`;
        });

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="products-${Date.now()}.csv"`);
        
        // Send CSV content
        res.send(csvContent);
        
        console.log('Đã xuất Excel danh sách sản phẩm thành công');
    } catch (err) {
        console.error('Lỗi khi xuất Excel danh sách sản phẩm:', err);
        res.status(500).render('error/500', {
            pageTitle: 'Lỗi',
            path: '/error',
            message: 'Không thể xuất Excel danh sách sản phẩm: ' + err.message
        });
    }
}; 