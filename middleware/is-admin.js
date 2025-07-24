module.exports = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).render('error/403', {
            pageTitle: 'Không có quyền truy cập',
            path: '/error',
            message: 'Bạn không có quyền truy cập trang này'
        });
    }
    next();
}; 