const express = require('express');
const router = express.Router();
const { protect, superadmin } = require('../middleware/authMiddleware');
const {
  getStats,
  getAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin,
  getStaff,
  toggleStaffStatus,
  deleteStaff,
  getLeads,
  getContacts,
  getPayments,
  getInvoices,
  getActivityLogs,
  getSettings,
  updateSettings
} = require('../controllers/superadminController');

// Secure all endpoints to authenticated Super Admins only
router.use(protect, superadmin);

router.get('/stats', getStats);
router.get('/admins', getAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.patch('/admins/:id/toggle', toggleAdminStatus);
router.delete('/admins/:id', deleteAdmin);

router.get('/staff', getStaff);
router.patch('/staff/:id/toggle', toggleStaffStatus);
router.delete('/staff/:id', deleteStaff);

router.get('/leads', getLeads);
router.get('/contacts', getContacts);
router.get('/payments', getPayments);
router.get('/invoices', getInvoices);
router.get('/logs', getActivityLogs);

router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;
