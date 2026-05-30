const express = require('express');
const router = express.Router();
const { createLead, getLeads, updateLead } = require('../controllers/leadController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createLead)
  .get(protect, getLeads);

router.route('/facebook/webhook')
  .get(require('../controllers/fbController').verifyWebhook)
  .post(require('../controllers/fbController').receiveWebhook);

router.route('/:id')
  .patch(protect, updateLead);

module.exports = router;
