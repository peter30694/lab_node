const productController = require('./product');
const orderController = require('./order');
const userController = require('./user');
const serviceController = require('./service');
const couponController = require('./coupon');
const reviewController = require('./review');
const newsletterController = require('./newsletter');
const contactController = require('./contact');
const bookingController = require('./booking');
const dashboardController = require('./dashboard');
const inventoryController = require('./inventory');
const mainController = require('./main');

module.exports = {
    ...productController,
    ...orderController,
    ...userController,
    ...serviceController,
    ...couponController,
    ...reviewController,
    ...newsletterController,
    ...contactController,
    ...bookingController,
    ...dashboardController,
    ...inventoryController,
    ...mainController
}; 