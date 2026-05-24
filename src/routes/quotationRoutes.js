const express = require('express');
const router = express.Router();
const { createQuotation, getQuotations, getQuotationById, updateQuotation } = require('../controllers/quotationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getQuotations).post(protect, createQuotation);
router.route('/:id').get(protect, getQuotationById).put(protect, updateQuotation);

module.exports = router;
