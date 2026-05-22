const Payment = require('../models/paymentModel');
const Lead = require('../models/leadModel');

// @desc    Add a payment for a lead
// @route   POST /api/payments
// @access  Private
const addPayment = async (req, res) => {
  const { leadId, amount, paymentDate, paymentMode, paymentType, remarks, referenceNo, bankName, chequeDate } = req.body;

  try {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check if staff is authorized for this lead
    if (req.user.role !== 'admin' && lead.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to add payment for this lead' });
    }

    const payment = await Payment.create({
      leadId,
      amount,
      paymentDate,
      paymentMode,
      paymentType,
      referenceNo,
      bankName,
      chequeDate,
      remarks,
      addedBy: req.user._id,
      owner: req.user.role === 'admin' ? req.user._id : req.user.owner,
    });

    // Update Lead status if it's a Booking Amount
    if (paymentType === 'Booking Amount') {
      await Lead.findByIdAndUpdate(leadId, { status: 'Booked' });
    }

    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get payments (Admin: all, Staff: assigned leads only)
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
  try {
    let query = { owner: req.user.role === 'admin' ? req.user._id : req.user.owner };

    if (req.user.role !== 'admin') {
      // Find leads assigned to this staff
      const leads = await Lead.find({ assignedTo: req.user._id }).select('_id');
      const leadIds = leads.map(l => l._id);
      query.leadId = { $in: leadIds };
    }

    const payments = await Payment.find(query)
      .populate('leadId', 'name phone email address quotationAmount')
      .populate('addedBy', 'name');
    
    res.json(payments);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { addPayment, getPayments };
