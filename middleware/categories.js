const Category = require('../models/category');

module.exports = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.locals.categories = categories;
  } catch (err) {
    res.locals.categories = [];
  }
  next();
}; 