const Contact = require('../models/contactModel');

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
    const contact = new Contact({
      name,
      phone,
      address,
      status: status || 'New',
      remarks: remarks || '',
      createdBy: req.user._id,
      owner: req.user._id,
    });
    const createdContact = await contact.save();
    res.status(201).json(createdContact);
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

    const formattedContacts = contactsList.map((c) => ({
      name: c.name,
      phone: c.phone ? String(c.phone) : '',
      address: c.address || '',
      status: c.status || 'New',
      remarks: c.remarks || '',
      createdBy: req.user._id,
      owner: req.user._id,
    }));

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
    const { status, remarks } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Authorize: Admin or assigned Telecaller
    if (req.user.role !== 'admin' && (!contact.assignedTo || contact.assignedTo.toString() !== req.user._id.toString())) {
      return res.status(401).json({ message: 'Not authorized to update this contact' });
    }

    if (status) {
      const validStatuses = ['New', 'No Answer', 'Call Back', 'Interested', 'Not Interested', 'Converted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid contact status' });
      }
      contact.status = status;
    }

    if (remarks !== undefined) {
      contact.remarks = remarks;
    }

    const updatedContact = await contact.save();
    res.json(updatedContact);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
};
