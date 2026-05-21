const Lead = require('../models/leadModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const Contact = require('../models/contactModel');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // If telecaller, return contact calling stats
    if (req.user.role === 'telecaller') {
      const totalContacts = await Contact.countDocuments({ assignedTo: req.user._id });
      const pendingContacts = await Contact.countDocuments({ assignedTo: req.user._id, status: 'New' });
      const convertedContacts = await Contact.countDocuments({ assignedTo: req.user._id, status: 'Converted' });
      
      const contactStatusDistribution = await Contact.aggregate([
        { $match: { assignedTo: req.user._id } },
        { $group: { _id: '$status', value: { $sum: 1 } } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ]);

      const recentContacts = await Contact.find({ assignedTo: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(5);

      return res.json({
        role: 'telecaller',
        totalContacts,
        pendingContacts,
        convertedContacts,
        contactStatusDistribution,
        recentContacts
      });
    }

    let leadQuery = { owner: req.user.role === 'admin' ? req.user._id : req.user.owner };
    let paymentQuery = { owner: req.user.role === 'admin' ? req.user._id : req.user.owner };
    
    // If staff, only show their data
    if (req.user.role === 'staff') {
      leadQuery.assignedTo = req.user._id;
      paymentQuery.leadId = { $in: await Lead.find({ assignedTo: req.user._id }).distinct('_id') };
    }

    const totalLeads = await Lead.countDocuments(leadQuery);
    const pendingLeads = await Lead.countDocuments({ ...leadQuery, status: 'New' });
    
    const payments = await Payment.find(paymentQuery);
    const totalRevenue = payments.reduce((acc, item) => acc + item.amount, 0);

    const recentLeads = await Lead.find(leadQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedTo', 'name');

    let staffCount = 0;
    if (req.user.role === 'admin') {
      staffCount = await User.countDocuments({ role: 'staff', owner: req.user._id, isDeleted: { $ne: true } });
    }

    // Lead growth data (last 6 months)
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
        ...leadQuery,
        createdAt: { $gte: start, $lte: end }
      });
      
      chartData.push({
        name: months[monthIndex],
        leads: count
      });
    }

    // Status distribution for Pie Chart
    const statusDistribution = await Lead.aggregate([
      { $match: leadQuery },
      { $group: { _id: '$status', value: { $sum: 1 } } },
      { $project: { name: '$_id', value: 1, _id: 0 } }
    ]);

    res.json({
      totalLeads,
      pendingLeads,
      totalRevenue,
      staffCount,
      recentLeads,
      chartData,
      statusDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardStats };
