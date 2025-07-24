const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news');

// Public routes
router.get('/', newsController.getNewsList);
router.get('/:id', newsController.getNewsDetail);

module.exports = router;