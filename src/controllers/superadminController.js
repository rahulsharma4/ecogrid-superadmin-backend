const User = require('../models/userModel');
const Lead = require('../models/leadModel');
const Contact = require('../models/contactModel');
const Payment = require('../models/paymentModel');
const Invoice = require('../models/invoiceModel');
const ActivityLog = require('../models/activityLogModel');
const SystemSettings = require('../models/systemSettingsModel');

// Helper to log administrative operations
const logActivity = async (userId, action, details, req) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '';
    await ActivityLog.create({
      user: userId,
      action,
      details,
      ipAddress,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
};

// @desc    Get global statistics for Super Admin dashboard
// @route   GET /api/superadmin/stats
// @access  Private/SuperAdmin
const getStats = async (req, res) => {
  try {
    const totalRevenueResult = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    const totalLeads = await Lead.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin', isDeleted: { $ne: true } });
    const totalStaff = await User.countDocuments({ role: { $in: ['staff', 'telecaller'] }, isDeleted: { $ne: true } });

    // Recent 10 leads globally
    const recentLeads = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('owner', 'name email')
      .populate('assignedTo', 'name email');

    // Monthly leads growth trend (last 6 months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();

      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);

      const count = await Lead.countDocuments({
        createdAt: { $gte: start, $lte: end }
      });

      chartData.push({
        name: months[monthIndex],
        leads: count
      });
    }

    // Lead status distribution
    const statusDistribution = await Lead.aggregate([
      { $group: { _id: '$status', value: { $sum: 1 } } },
      { $project: { name: '$_id', value: 1, _id: 0 } }
    ]);

    // Top Admins aggregation by revenue and lead count
    const topAdmins = await User.aggregate([
      { $match: { role: 'admin', isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'owner',
          as: 'leads'
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'owner',
          as: 'payments'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          leadCount: { $size: '$leads' },
          revenue: { $sum: '$payments.amount' }
        }
      },
      { $sort: { revenue: -1, leadCount: -1 } },
      { $limit: 5 }
    ]);

    const systemHealth = {
      dbStatus: 'Connected',
      uptime: process.uptime(),
      nodeVersion: process.version,
      port: process.env.PORT || 5002,
    };

    res.json({
      role: 'superadmin',
      totalRevenue,
      totalLeads,
      totalAdmins,
      totalStaff,
      recentLeads,
      chartData,
      statusDistribution,
      topAdmins,
      systemHealth
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all admins with their statistics
// @route   GET /api/superadmin/admins
// @access  Private/SuperAdmin
const getAdmins = async (req, res) => {
  try {
    const admins = await User.aggregate([
      { $match: { role: 'admin', isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'users',
          let: { adminId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$owner', '$$adminId'] }, { $ne: ['$isDeleted', true] }] } } }
          ],
          as: 'staff'
        }
      },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'owner',
          as: 'leads'
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'owner',
          as: 'payments'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          status: 1,
          createdAt: 1,
          staffCount: { $size: '$staff' },
          leadCount: { $size: '$leads' },
          revenue: { $sum: '$payments.amount' }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new admin manually
// @route   POST /api/superadmin/admins
// @access  Private/SuperAdmin
const createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const newAdmin = new User({
      name,
      email,
      phone,
      password,
      role: 'admin',
      status: 'active'
    });

    await newAdmin.save();
    await logActivity(req.user._id, 'CREATE_ADMIN', `Created new Admin account: ${name} (${email})`, req);

    res.status(201).json({
      _id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      role: newAdmin.role,
      status: newAdmin.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update admin details
// @route   PUT /api/superadmin/admins/:id
// @access  Private/SuperAdmin
const updateAdmin = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.name = req.body.name || admin.name;
    admin.email = req.body.email || admin.email;
    admin.phone = req.body.phone || admin.phone;

    if (req.body.password) {
      admin.password = req.body.password;
    }

    await admin.save();
    await logActivity(req.user._id, 'UPDATE_ADMIN', `Updated Admin account details: ${admin.name} (${admin.email})`, req);

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle admin status (Block/Unblock)
// @route   PATCH /api/superadmin/admins/:id/toggle
// @access  Private/SuperAdmin
const toggleAdminStatus = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.status = admin.status === 'active' ? 'inactive' : 'active';
    await admin.save();
    await logActivity(req.user._id, 'TOGGLE_ADMIN_STATUS', `Toggled Admin status to ${admin.status} for ${admin.name}`, req);

    res.json({
      message: `Admin status toggled to ${admin.status}`,
      status: admin.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Soft delete an Admin
// @route   DELETE /api/superadmin/admins/:id
// @access  Private/SuperAdmin
const deleteAdmin = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.isDeleted = true;
    admin.status = 'inactive';
    await admin.save();
    await logActivity(req.user._id, 'DELETE_ADMIN', `Soft-deleted Admin account: ${admin.name}`, req);

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all staff globally
// @route   GET /api/superadmin/staff
// @access  Private/SuperAdmin
const getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ['staff', 'telecaller'] }, isDeleted: { $ne: true } })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle staff active/inactive status globally
// @route   PATCH /api/superadmin/staff/:id/toggle
// @access  Private/SuperAdmin
const toggleStaffStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !['staff', 'telecaller'].includes(user.role)) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();
    await logActivity(req.user._id, 'TOGGLE_STAFF_STATUS', `Toggled Staff/Telecaller status to ${user.status} for ${user.name}`, req);

    res.json({
      message: `Staff member status toggled to ${user.status}`,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Soft delete a staff member globally
// @route   DELETE /api/superadmin/staff/:id
// @access  Private/SuperAdmin
const deleteStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !['staff', 'telecaller'].includes(user.role)) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    user.isDeleted = true;
    user.status = 'inactive';
    await user.save();
    await logActivity(req.user._id, 'DELETE_STAFF', `Soft-deleted staff member: ${user.name}`, req);

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all leads globally
// @route   GET /api/superadmin/leads
// @access  Private/SuperAdmin
const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('owner', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all contacts globally
// @route   GET /api/superadmin/contacts
// @access  Private/SuperAdmin
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find()
      .populate('owner', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payments globally
// @route   GET /api/superadmin/payments
// @access  Private/SuperAdmin
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('owner', 'name email')
      .populate('leadId', 'name')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all invoices globally
// @route   GET /api/superadmin/invoices
// @access  Private/SuperAdmin
const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('owner', 'name email')
      .populate('leadId', 'name')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get activity logs
// @route   GET /api/superadmin/logs
// @access  Private/SuperAdmin
const getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get system settings
// @route   GET /api/superadmin/settings
// @access  Private/SuperAdmin
const getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/superadmin/settings
// @access  Private/SuperAdmin
const updateSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings({});
    }

    settings.maintenanceMode = req.body.maintenanceMode !== undefined ? req.body.maintenanceMode : settings.maintenanceMode;
    settings.allowNewAdminRegistration = req.body.allowNewAdminRegistration !== undefined ? req.body.allowNewAdminRegistration : settings.allowNewAdminRegistration;
    settings.installationTargetkW = req.body.installationTargetkW !== undefined ? req.body.installationTargetkW : settings.installationTargetkW;
    settings.contactEmail = req.body.contactEmail !== undefined ? req.body.contactEmail : settings.contactEmail;
    settings.updatedBy = req.user._id;

    await settings.save();
    await logActivity(req.user._id, 'UPDATE_SETTINGS', 'Updated global system settings configuration', req);

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
  updateSettings,
  logActivity // Exported to use elsewhere if needed
};
