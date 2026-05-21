const Contact = require('../models/contactModel');
const mongoose = require('mongoose');

// @desc    Get all contacts (Admin gets all owned, telecaller gets assigned)
// @route   GET /api/contacts
// @access  Private
const getContacts = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      query = { owner: req.user._id };
    } else {
      query = { assignedTo: req.user._id };
    }
    const contacts = await Contact.find(query)
      .populate('assignedTo', 'name email phone role')
      .populate('createdBy', 'name role')
      .populate('updatedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a single contact
// @route   POST /api/contacts
// @access  Private/Admin
const createContact = async (req, res) => {
  try {
    const { name, phone, address, status, remarks } = req.body;
    const initialStatus = status || 'New';
    const initialRemarks = remarks || '';
    const contact = new Contact({
      name,
      phone,
      address,
      status: initialStatus,
      remarks: initialRemarks,
      createdBy: req.user._id,
      owner: req.user._id,
      statusHistory: [
        {
          status: initialStatus,
          remarks: initialRemarks,
          updatedBy: req.user._id,
          updatedAt: new Date()
        }
      ]
    });
    const createdContact = await contact.save();
    const populatedContact = await Contact.findById(createdContact._id)
      .populate('createdBy', 'name role')
      .populate('updatedBy', 'name role')
      .populate('statusHistory.updatedBy', 'name role');
    res.status(201).json(populatedContact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Bulk create contacts from list
// @route   POST /api/contacts/bulk
// @access  Private/Admin
const bulkCreateContacts = async (req, res) => {
  try {
    const contactsList = Array.isArray(req.body) ? req.body : req.body.contacts;
    if (!contactsList || !Array.isArray(contactsList)) {
      return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
    }

    const formattedContacts = contactsList.map((c) => {
      const initialStatus = c.status || 'New';
      const initialRemarks = c.remarks || '';
      return {
        name: c.name,
        phone: c.phone ? String(c.phone) : '',
        address: c.address || '',
        status: initialStatus,
        remarks: initialRemarks,
        createdBy: req.user._id,
        owner: req.user._id,
        statusHistory: [
          {
            status: initialStatus,
            remarks: initialRemarks,
            updatedBy: req.user._id,
            updatedAt: new Date()
          }
        ]
      };
    });

    const createdContacts = await Contact.insertMany(formattedContacts);
    res.status(201).json(createdContacts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a contact
// @route   DELETE /api/contacts/:id
// @access  Private/Admin
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (contact) {
      if (req.user.role !== 'admin' || contact.owner.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized to delete this contact' });
      }
      await contact.deleteOne();
      res.json({ message: 'Contact removed successfully' });
    } else {
      res.status(404).json({ message: 'Contact not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign multiple contacts to a telecaller
// @route   PATCH /api/contacts/assign
// @access  Private/Admin
const assignContacts = async (req, res) => {
  try {
    const { contactIds, assignedTo } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'No contacts selected' });
    }

    if (assignedTo) {
      const User = require('../models/userModel');
      const telecaller = await User.findOne({ _id: assignedTo, role: 'telecaller', isDeleted: { $ne: true } });
      if (!telecaller) {
        return res.status(400).json({ message: 'Invalid telecaller selected' });
      }
    }

    // Verify that none of the selected contacts are already assigned
    const alreadyAssigned = await Contact.countDocuments({
      _id: { $in: contactIds },
      owner: req.user._id,
      assignedTo: { $ne: null }
    });
    if (alreadyAssigned > 0) {
      return res.status(400).json({ message: 'One or more selected contacts are already assigned and cannot be re-assigned' });
    }

    const updateData = { assignedTo: assignedTo || null };
    await Contact.updateMany(
      { _id: { $in: contactIds }, owner: req.user._id },
      { $set: updateData }
    );
    res.json({ message: 'Contacts assigned successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Convert contact to a Lead
// @route   POST /api/contacts/:id/convert
// @access  Private
const convertContactToLead = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Authorize: Admin or assigned Telecaller
    if (req.user.role !== 'admin' && (!contact.assignedTo || contact.assignedTo.toString() !== req.user._id.toString())) {
      return res.status(401).json({ message: 'Not authorized to convert this contact' });
    }

    if (contact.status === 'Converted') {
      return res.status(400).json({ message: 'Contact is already converted to a lead' });
    }

    const Lead = require('../models/leadModel');
    const { 
      solarCapacity, roofType, propertyType, remarks, name, phone, address,
      email, quotationAmount, technicalRemarks, companyName, companyAddress, gstNumber,
      personalInfo
    } = req.body;

    const lead = new Lead({
      name: name || contact.name,
      phone: phone || contact.phone,
      address: address || contact.address,
      email: email || undefined,
      solarCapacity: solarCapacity || '',
      roofType: roofType || '',
      propertyType: propertyType || '',
      quotationAmount: quotationAmount || 0,
      technicalRemarks: technicalRemarks || '',
      companyName: companyName || '',
      companyAddress: companyAddress || '',
      gstNumber: gstNumber || '',
      personalInfo: personalInfo || {},
      source: 'Telecalling',
      assignedTo: null, // initially unassigned
      createdBy: req.user._id,
      owner: req.user.role === 'admin' ? req.user._id : req.user.owner,
      history: [
        {
          status: 'New',
          comment: remarks || 'Lead created via Telecalling conversion',
          updatedBy: req.user._id,
        }
      ]
    });

    const createdLead = await lead.save();

    contact.status = 'Converted';
    if (remarks) {
      contact.remarks = remarks;
    }
    contact.updatedBy = req.user._id;
    contact.statusHistory.push({
      status: 'Converted',
      remarks: remarks || 'Converted to Lead',
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
    await contact.save();

    res.status(201).json({
      message: 'Contact converted to Lead successfully',
      lead: createdLead,
      contact
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a contact's status and remarks
// @route   PATCH /api/contacts/:id
// @access  Private
const updateContact = async (req, res) => {
  try {
    const { status, remarks, callBackDate } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Authorize: Admin or assigned Telecaller
    if (req.user.role !== 'admin' && (!contact.assignedTo || contact.assignedTo.toString() !== req.user._id.toString())) {
      return res.status(401).json({ message: 'Not authorized to update this contact' });
    }

    let isNewCallBack = false;
    if (status) {
      const validStatuses = ['New', 'No Answer', 'Call Back', 'Interested', 'Not Interested', 'Converted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid contact status' });
      }
      contact.status = status;
      if (status !== 'Call Back') {
        contact.callBackDate = null;
        contact.callBackNotified = false;
      }
    }

    if (callBackDate !== undefined) {
      const newDate = callBackDate ? new Date(callBackDate) : null;
      const oldDateStr = contact.callBackDate ? new Date(contact.callBackDate).toISOString() : null;
      const newDateStr = newDate ? newDate.toISOString() : null;

      if (newDateStr !== oldDateStr) {
        contact.callBackDate = newDate;
        contact.callBackNotified = false;
        isNewCallBack = !!newDate;
      }
    }

    if (remarks !== undefined) {
      contact.remarks = remarks;
    }

    contact.updatedBy = req.user._id;

    // Log update into statusHistory
    contact.statusHistory.push({
      status: contact.status,
      remarks: contact.remarks,
      callBackDate: contact.callBackDate,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    await contact.save();

    const populatedContact = await Contact.findById(contact._id)
      .populate('assignedTo', 'name email phone role')
      .populate('createdBy', 'name role')
      .populate('updatedBy', 'name role')
      .populate('statusHistory.updatedBy', 'name role');

    // Create notification if a new callback is scheduled
    if (isNewCallBack && contact.callBackDate) {
      const Notification = require('../models/notificationModel');
      const followDate = new Date(contact.callBackDate);
      const dateStr = followDate.toLocaleDateString('en-GB');
      const timeStr = followDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Notify the assigned telecaller (if assigned)
      if (contact.assignedTo) {
        await Notification.create({
          recipient: contact.assignedTo,
          title: 'Callback Scheduled',
          message: `New callback scheduled for ${contact.name} on ${dateStr} at ${timeStr}`,
          type: 'FollowUp',
          relatedId: contact._id
        });
      }

      // Also notify admin if someone else updated it
      if (req.user.role !== 'admin') {
        await Notification.create({
          recipient: contact.owner, // Admin who owns the system
          title: 'Telecaller Scheduled Callback',
          message: `${req.user.name} scheduled a callback for ${contact.name} on ${dateStr} at ${timeStr}`,
          type: 'FollowUp',
          relatedId: contact._id
        });
      }
    }

    res.json(populatedContact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get single contact details
// @route   GET /api/contacts/:id
// @access  Private
const getContactDetails = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email phone role')
      .populate('createdBy', 'name role')
      .populate('updatedBy', 'name role')
      .populate('statusHistory.updatedBy', 'name role');

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Authorize: Admin or assigned Telecaller
    if (req.user.role !== 'admin' && (!contact.assignedTo || contact.assignedTo._id.toString() !== req.user._id.toString())) {
      return res.status(401).json({ message: 'Not authorized to view this contact' });
    }

    // Dynamic fallback for older contacts that don't have statusHistory
    const contactObj = contact.toObject();
    if (!contactObj.statusHistory || contactObj.statusHistory.length === 0) {
      contactObj.statusHistory = [
        {
          _id: new mongoose.Types.ObjectId(),
          status: contactObj.status,
          remarks: contactObj.remarks || 'No initial remarks recorded',
          callBackDate: contactObj.callBackDate,
          updatedBy: contactObj.createdBy || contactObj.owner,
          updatedAt: contactObj.createdAt
        }
      ];
    }

    res.json(contactObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getContacts,
  createContact,
  bulkCreateContacts,
  deleteContact,
  assignContacts,
  convertContactToLead,
  updateContact,
  getContactDetails,
};
