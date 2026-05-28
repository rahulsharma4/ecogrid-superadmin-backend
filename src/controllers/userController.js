const User = require('../models/userModel');
const generateToken = require('../config/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (user.isDeleted) {
        return res.status(401).json({ message: 'Your account has been deleted. Please contact admin.' });
      }
      if (user.status === 'inactive') {
        return res.status(401).json({ message: 'Your account is inactive. Please contact admin.' });
      }

      // Log login event
      try {
        const ActivityLog = require('../models/activityLogModel');
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        await ActivityLog.create({
          user: user._id,
          action: 'LOGIN',
          details: `${user.name} (${user.role}) logged in successfully`,
          ipAddress,
        });
      } catch (logErr) {
        console.error('Activity log error:', logErr.message);
      }

      let companyDetails = user.companyDetails;
      if (user.role === 'staff' || user.role === 'telecaller') {
        const ownerUser = await User.findById(user.owner);
        if (ownerUser) {
          companyDetails = ownerUser.companyDetails;
        }
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.password),
        companyDetails,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const isAdminCreating = req.user && req.user.role === 'admin';
    
    // Check if new admin registration is allowed globally
    if (!isAdminCreating) {
      const SystemSettings = require('../models/systemSettingsModel');
      const settings = await SystemSettings.findOne();
      if (settings && settings.allowNewAdminRegistration === false) {
        return res.status(403).json({ message: 'New Administrator registrations are currently disabled by system policy.' });
      }
    }

    const user = new User({
      name,
      email,
      phone,
      password,
      role: isAdminCreating ? (role || 'staff') : 'admin',
      owner: isAdminCreating ? req.user._id : null,
    });

    await user.save();

    if (user) {
      // Log registration event
      try {
        const ActivityLog = require('../models/activityLogModel');
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        await ActivityLog.create({
          user: user._id,
          action: 'REGISTER',
          details: `New ${user.role} account registered: ${user.name} (${user.email})`,
          ipAddress,
        });
      } catch (logErr) {
        console.error('Activity log error:', logErr.message);
      }

      // Return only essential fields to keep response clean and fast
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all staff
// @route   GET /api/staff
// @access  Private/Admin
const getStaff = async (req, res) => {
  const staff = await User.find({ 
    role: { $in: ['staff', 'telecaller'] }, 
    owner: req.user._id,
    isDeleted: { $ne: true }
  });
  res.json(staff);
};

// @desc    Delete staff (Soft Delete)
// @route   DELETE /api/staff/:id
// @access  Private/Admin
const deleteStaff = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.isDeleted = true;
    user.status = 'inactive';
    await user.save();
    res.json({ message: 'Staff member removed successfully (Data preserved)' });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Get staff details with assigned leads
// @route   GET /api/staff/:id
// @access  Private/Admin
const getStaffDetails = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id).select('-password');
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    let leads = [];
    let contacts = [];

    if (staff.role === 'telecaller') {
      const Contact = require('../models/contactModel');
      contacts = await Contact.find({ assignedTo: req.params.id }).sort({ updatedAt: -1 });
    } else {
      const Lead = require('../models/leadModel');
      leads = await Lead.find({ assignedTo: req.params.id }).sort({ updatedAt: -1 });
    }

    res.json({
      staff,
      leads,
      contacts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle staff active/inactive status (Block/Unblock)
// @route   PATCH /api/staff/:id/toggle-status
// @access  Private/Admin
const toggleStaffStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify ownership
    if (user.owner && user.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to manage this staff member' });
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();

    res.json({
      message: `Staff member status updated to ${user.status}`,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCompanySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.companyDetails) {
      user.companyDetails = {};
    }

    // Set updated values individually so Mongoose tracks modifications properly
    if (req.body) {
      Object.keys(req.body).forEach((key) => {
        user.companyDetails[key] = req.body[key];
      });
      // Explicitly mark companyDetails as modified
      user.markModified('companyDetails');
    }

    await user.save();

    // Log activity
    try {
      const ActivityLog = require('../models/activityLogModel');
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      await ActivityLog.create({
        user: user._id,
        action: 'UPDATE_COMPANY_SETTINGS',
        details: `Admin ${user.name} updated white-label company settings`,
        ipAddress,
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr.message);
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyDetails: user.companyDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCompanySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.companyDetails || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCompanyByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email query is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let companyDetails = user.companyDetails;
    if (user.role === 'staff' || user.role === 'telecaller') {
      const ownerUser = await User.findById(user.owner);
      if (ownerUser) {
        companyDetails = ownerUser.companyDetails;
      }
    }

    res.json(companyDetails || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update staff details
// @route   PUT /api/staff/:id
// @access  Private/Admin
const updateStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify ownership
    if (user.owner && user.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to manage this staff member' });
    }

    const { name, email, phone, password, role, status } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (status) user.status = status;

    let passwordChanged = false;
    if (password && password.trim() !== '') {
      user.password = password;
      passwordChanged = true;
    }

    await user.save();

    // Log update event
    try {
      const ActivityLog = require('../models/activityLogModel');
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      await ActivityLog.create({
        user: req.user._id,
        action: 'UPDATE_STAFF',
        details: `Staff member updated: ${user.name} (${user.email}). ${passwordChanged ? 'Password was updated/reset.' : ''}`,
        ipAddress,
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr.message);
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  authUser,
  registerUser,
  getStaff,
  deleteStaff,
  getStaffDetails,
  toggleStaffStatus,
  updateCompanySettings,
  getCompanySettings,
  getCompanyByEmail,
  updateStaff
};
