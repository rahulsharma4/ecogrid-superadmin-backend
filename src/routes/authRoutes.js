const express = require('express');
const router = express.Router();
const { 
  authUser, 
  registerUser, 
  getCompanyByEmail, 
  getCompanySettings, 
  updateCompanySettings 
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/login', authUser);
router.post('/register', registerUser);
router.get('/company-by-email', getCompanyByEmail);

router.route('/company-settings')
  .get(protect, admin, getCompanySettings)
  .put(protect, admin, updateCompanySettings);

module.exports = router;
