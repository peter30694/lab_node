/**
 * Middleware để xử lý AJAX responses - Updated
 */

const handleAjaxResponse = (req, res, next) => {
    // Kiểm tra nếu là AJAX request
    const isAjax = req.xhr || 
                   (req.headers.accept && req.headers.accept.indexOf('json') > -1) || 
                   req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
        // Override res.redirect để trả về JSON cho AJAX
        const originalRedirect = res.redirect;
        res.redirect = function(url) {
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                const successMessages = req.flash('success');
                const errorMessages = req.flash('error');
                
                return res.json({
                    success: successMessages.length > 0,
                    message: successMessages[0] || errorMessages[0] || 'Thành công!',
                    redirect: url
                });
            }
            return originalRedirect.call(this, url);
        };

        // Override res.render để trả về JSON nếu có flash messages
        const originalRender = res.render;
        res.render = function(view, locals, callback) {
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                const successMessages = req.flash('success');
                const errorMessages = req.flash('error');
                
                if (successMessages.length > 0 || errorMessages.length > 0) {
                    return res.json({
                        success: successMessages.length > 0,
                        message: successMessages[0] || errorMessages[0],
                        redirect: req.originalUrl
                    });
                }
            }
            return originalRender.call(this, view, locals, callback);
        };
    }
    
    next();
};

module.exports = handleAjaxResponse;