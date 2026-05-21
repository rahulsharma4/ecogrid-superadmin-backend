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
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
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

    // Also get leads assigned to this staff
    const Lead = require('../models/leadModel');
    const leads = await Lead.find({ assignedTo: req.params.id }).sort({ updatedAt: -1 });

    res.json({
      staff,
      leads
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { authUser, registerUser, getStaff, deleteStaff, getStaffDetails };
