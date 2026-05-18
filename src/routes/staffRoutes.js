const express = require('express');
const router = express.Router();
const { getStaff, deleteStaff, registerUser, getStaffDetails } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, admin, getStaff)
  .post(protect, admin, registerUser);

router.route('/:id')
  .get(protect, admin, getStaffDetails)
  .delete(protect, admin, deleteStaff);

module.exports = router;
