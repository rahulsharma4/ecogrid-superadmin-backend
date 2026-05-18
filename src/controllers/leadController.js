const Lead = require('../models/leadModel');
const Notification = require('../models/notificationModel');

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res) => {
  const { name, email, phone, address, solarCapacity, roofType, propertyType, source, assignedTo, personalInfo } = req.body;

  try {
    const lead = await Lead.create({
      name,
      email,
      phone,
      address,
      solarCapacity,
      roofType,
      propertyType,
      source,
      personalInfo,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      owner: req.user.role === 'admin' ? req.user._id : req.user.owner,
    });

    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all leads (Admin: all, Staff: assigned only)
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res) => {
  try {
    let query = { owner: req.user.role === 'admin' ? req.user._id : req.user.owner };

    // If not admin, only show assigned leads
    if (req.user.role !== 'admin') {
      query.assignedTo = req.user._id;
    }

    const leads = await Lead.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('history.updatedBy', 'name');
    res.json(leads);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update lead status or details
// @route   PATCH /api/leads/:id
// @access  Private
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (lead) {
      // Check if lead is closed
      if (lead.status === 'Closed') {
        return res.status(400).json({ message: 'This lead is closed and cannot be modified' });
      }

      // Check if staff is authorized to update this lead
      if (req.user.role !== 'admin' && lead.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized to update this lead' });
      }

      if (req.body.status && req.body.status !== lead.status) {
        // Clear follow-up if status moves to 'Meeting Done' or further
        const completionStatuses = ['Meeting Done', 'Quotation Sent', 'Booked', 'Installation Underway', 'Completed', 'Cancelled', 'Closed'];
        if (completionStatuses.includes(req.body.status)) {
          lead.followUpDate = null;
          lead.followUpStatus = 'Completed';
        }

        lead.history.push({
          status: req.body.status,
          comment: req.body.comment || 'Status updated',
          updatedBy: req.user._id,
        });
        lead.status = req.body.status;
      }

      lead.name = req.body.name || lead.name;
      lead.email = req.body.email || lead.email;
      lead.phone = req.body.phone || lead.phone;
      lead.address = req.body.address || lead.address;
      lead.solarCapacity = req.body.solarCapacity || lead.solarCapacity;
      lead.roofType = req.body.roofType || lead.roofType;
      lead.propertyType = req.body.propertyType || lead.propertyType;
      lead.followUpDate = req.body.followUpDate || lead.followUpDate;
      lead.followUpStatus = req.body.followUpStatus || lead.followUpStatus;
      lead.followUpRemarks = req.body.followUpRemarks || lead.followUpRemarks;
      lead.quotationAmount = req.body.quotationAmount || lead.quotationAmount;
      lead.technicalRemarks = req.body.technicalRemarks || lead.technicalRemarks;
      lead.companyName = req.body.companyName || lead.companyName;
      lead.companyAddress = req.body.companyAddress || lead.companyAddress;
      lead.gstNumber = req.body.gstNumber || lead.gstNumber;

      if (req.body.personalInfo) {
        lead.personalInfo = { ...lead.personalInfo, ...req.body.personalInfo };
      }

      // Only admin can reassign leads
      if (req.user.role === 'admin') {
        lead.assignedTo = req.body.assignedTo || lead.assignedTo;
      }

      const isNewFollowUp = req.body.followUpDate && req.body.followUpDate !== lead.followUpDate?.toISOString();

      const updatedLead = await lead.save();

      // Create notification for follow-up
      if (isNewFollowUp) {
        const followDate = new Date(req.body.followUpDate);
        const dateStr = followDate.toLocaleDateString('en-GB');
        const timeStr = followDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        await Notification.create({
          recipient: lead.assignedTo,
          title: 'Follow-up Scheduled',
          message: `New follow-up for ${lead.name} on ${dateStr} at ${timeStr}`,
          type: 'FollowUp',
          relatedId: lead._id
        });

        // Also notify admin if staff updated it
        if (req.user.role !== 'admin') {
          await Notification.create({
            recipient: lead.owner, // Admin who owns the system
            title: 'Staff Scheduled Follow-up',
            message: `${req.user.name} scheduled a follow-up for ${lead.name} on ${dateStr} at ${timeStr}`,
            type: 'FollowUp',
            relatedId: lead._id
          });
        }
      }

      res.json(updatedLead);
    } else {
      res.status(404).json({ message: 'Lead not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createLead, getLeads, updateLead };
