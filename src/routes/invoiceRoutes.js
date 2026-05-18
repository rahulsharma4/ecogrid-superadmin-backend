const express = require('express');
const router = express.Router();
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getInvoices).post(protect, createInvoice);

module.exports = router;
