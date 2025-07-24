const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact');

// Contact form submission
router.post('/submit', contactController.submitContact);

module.exports = router; 