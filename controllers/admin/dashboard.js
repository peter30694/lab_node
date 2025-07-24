const Product = require('../../models/product');
const Order = require('../../models/order');
const User = require('../../models/user');
const Service = require('../../models/service');
const Review = require('../../models/review');
const Coupon = require('../../models/coupon');
const Contact = require('../../models/contact');
const { getDb } = require('../../util/database');
const { generateDashboardReportPDF } = require('../../util/pdf');
const fs = require('fs');


exports.getDashboard = async (req, res) => {
  try {
    // Lấy dữ liệu
    const products = await require('../../models/product').find({});
    const orders = await require('../../models/order').findAll();
    const db = require('../../util/database').getDb();
    const users = await db.collection('users').find({}).toArray();
    const Service = require('../../models/service');
    const servicesResult = await Service.fetchAll(1000, 1);
    const Review = require('../../models/review');
    // const reviewsResult = await Review.fetchAll(1000, 1);
    const allReviews = await db.collection('reviews').find({}).toArray();
    console.log('ALL REVIEWS DIRECT:', allReviews.map(r => r.status));
    const coupons = await db.collection('coupons').find({}).toArray();
    const Contact = require('../../models/contact');
    const newsletterSubscribers = await Contact.findAllNewsletterSubscribers();

    // Tổng hợp thống kê cơ bản
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalUsers = users.length;
    const totalServices = servicesResult.total || 0;
    const totalReviews = allReviews.length;
    const totalCoupons = coupons.length;
    const totalNewsletterSubscribers = newsletterSubscribers.length;
    const totalRevenue = orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'completed').reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    // Thống kê đơn hàng
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'completed').length;
    const pendingPaymentOrders = orders.filter(o => o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting').length;
    const processingOrders = orders.filter(o => o.status === 'processing').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    // Thống kê đánh giá
    const approvedReviews = Array.isArray(allReviews) ? allReviews.filter(r => r.status === 'approved').length : 0;
    const pendingReviews = Array.isArray(allReviews) ? allReviews.filter(r => r.status === 'pending').length : 0;
    // Log kiểm tra trạng thái review
    console.log('DEBUG REVIEW:', {
      allStatuses: Array.isArray(allReviews) ? allReviews.map(r => r.status) : [],
      approvedReviews,
      pendingReviews,
      total: Array.isArray(allReviews) ? allReviews.length : 0
    });

    // Thống kê coupon
    const now = new Date();
    const activeCoupons = coupons.filter(c => c.isActive && c.startDate <= now && c.endDate >= now).length;
    const expiringCoupons = coupons.filter(c => c.isActive && c.endDate && (c.endDate - now) / (1000 * 60 * 60 * 24) <= 7 && c.endDate >= now).length;

    // Thống kê tồn kho
    const outOfStockProducts = products.filter(p => !p.stockQuantity || p.stockQuantity === 0).length;
    const lowStockProducts = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 10).length;
    const totalStockValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stockQuantity || 0)), 0);

    // Thống kê dịch vụ
    const activeServices = Array.isArray(servicesResult.services) ? servicesResult.services.filter(s => s.status === 'active').length : 0;

    // Lấy sản phẩm phổ biến và doanh thu theo tháng
    const Order = require('../../models/order');
    const popularProducts = await Order.getPopularProducts ? await Order.getPopularProducts(5) : [];
    const monthlyRevenueArr = await Order.getMonthlyRevenue ? await Order.getMonthlyRevenue() : [];

    // Tính doanh thu tháng hiện tại
    let thisMonthRevenue = 0;
    if (Array.isArray(monthlyRevenueArr)) {
      const now = new Date();
      const thisMonth = now.getMonth() + 1;
      const thisYear = now.getFullYear();
      const found = monthlyRevenueArr.find(r => {
        if (!r.month) return false;
        const [m, y] = r.month.split('/');
        return parseInt(m) === thisMonth && parseInt(y) === thisYear;
      });
      thisMonthRevenue = found ? found.revenue : 0;
    }

    // Lấy 5 đơn hàng mới nhất
    const recentOrders = orders
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const stats = {
      totalProducts,
      totalOrders,
      totalUsers,
      totalServices,
      totalReviews,
      totalCoupons,
      totalNewsletterSubscribers,
      totalRevenue,
      pendingOrders,
      paidOrders,
      pendingPaymentOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      approvedReviews,
      pendingReviews,
      activeCoupons,
      expiringCoupons,
      outOfStockProducts,
      lowStockProducts,
      totalStockValue,
      activeServices,
      monthlyRevenue: thisMonthRevenue
    };

    console.log('Render dashboard with:', { stats, popularProducts, monthlyRevenueArr, recentOrders });
    res.render('admin/dashboard', {
      pageTitle: 'Trang quản trị',
      path: '/admin/dashboard',
      stats,
      popularProducts,
      topProducts: popularProducts,
      monthlyRevenue: monthlyRevenueArr,
      monthlyStats: monthlyRevenueArr,
      recentOrders,
      isAuthenticated: req.session.user ? true : false,
      isAdmin: req.session.user && req.session.user.role === 'admin',
      user: req.session.user || null
    });
  } catch (err) {
    console.error('Lỗi khi render dashboard:', err);
    res.status(500).render('error/500', {
      pageTitle: 'Lỗi',
      path: '/error',
      message: 'Không thể tải trang dashboard: ' + err.message,
      isAuthenticated: req.session.user ? true : false,
      isAdmin: req.session.user && req.session.user.role === 'admin',
      user: req.session.user || null
    });
  }
};

exports.exportDashboardPDF = async (req, res) => {
    try {
        const { stats, popularProducts, monthlyRevenue } = await getDashboardData();
        const filePath = await generateDashboardReportPDF({
            ...stats,
            topProducts: popularProducts,
            monthlyStats: monthlyRevenue
        });

        // Đọc file PDF thành buffer
        const pdfBuffer = fs.readFileSync(filePath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=dashboard-report.pdf');
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Lỗi khi xuất PDF trang tổng quan:', err);
        res.status(500).send('Lỗi khi xuất PDF trang tổng quan');
    }
};

async function getDashboardData() {
    const [products, orders, users, servicesResult, reviewsResult, coupons, newsletterSubscribers] = await Promise.all([
      Product.find({}),
      Order.findAll(),
      (async () => { const db = getDb(); return db.collection('users').find({}).toArray(); })(),
      Service.fetchAll(1000, 1),
      Review.fetchAll(1000, 1),
      (async () => { const db = getDb(); return db.collection('coupons').find({}).toArray(); })(),
      Contact.findAllNewsletterSubscribers()
    ]);

    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalUsers = users.length;
    const totalServices = servicesResult.total || 0;
    const totalReviews = reviewsResult.total || 0;
    const totalCoupons = coupons.length;
    const totalNewsletterSubscribers = newsletterSubscribers.length;
    const totalRevenue = orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'completed').reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const popularProducts = await Order.getPopularProducts(5);
    const monthlyRevenue = await Order.getMonthlyRevenue();

    return {
        stats: { totalProducts, totalOrders, totalUsers, totalServices, totalReviews, totalRevenue, totalCoupons, totalNewsletterSubscribers, pendingOrders },
        popularProducts,
        monthlyRevenue
    };
} 