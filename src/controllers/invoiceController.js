const Invoice = require('../models/invoiceModel');
const Quotation = require('../models/quotationModel');

// @desc    Create a new invoice (from scratch or quotation)
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
  try {
    const { 
      leadId, quotationId, systemSize, solarPanels, inverter,
      baseAmount, gstPercentage, amountPaid, bankDetails, isGstInclusive
    } = req.body;

    // Generate Invoice Number (e.g. INV-2026-0001)
    const year = new Date().getFullYear();
    const lastInvoice = await Invoice.findOne({
        invoiceNo: new RegExp(`^INV-${year}-`)
    }).sort({ invoiceNo: -1 });

    let nextNumber = 1;
    if (lastInvoice) {
        const lastNo = parseInt(lastInvoice.invoiceNo.split('-')[2]);
        nextNumber = lastNo + 1;
    }
    const invoiceNo = `INV-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Calculations
    const isInclusive = isGstInclusive === true || isGstInclusive === 'true';
    const gstPerc = isInclusive ? 8.9 : (Number(gstPercentage) || 0);

    let gstAmount = 0;
    let totalAmount = 0;
    let storedBaseAmount = 0;

    if (isInclusive) {
      totalAmount = Number(baseAmount) || 0;
      gstAmount = (totalAmount * 8.9) / 108.9;
      storedBaseAmount = totalAmount - gstAmount;
    } else {
      storedBaseAmount = Number(baseAmount) || 0;
      gstAmount = (storedBaseAmount * gstPerc) / 100;
      totalAmount = storedBaseAmount + gstAmount;
    }

    const balanceAmount = totalAmount - Number(amountPaid || 0);
    
    let paymentStatus = 'Unpaid';
    if (amountPaid > 0) {
      paymentStatus = amountPaid >= totalAmount ? 'Paid' : 'Partially Paid';
    }

    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;

    const invoice = await Invoice.create({
      lead: leadId,
      quotation: quotationId,
      invoiceNo,
      systemSize,
      solarPanels,
      inverter,
      baseAmount: storedBaseAmount,
      gstPercentage: gstPerc,
      gstAmount,
      isGstInclusive: isInclusive,
      totalAmount,
      amountPaid: amountPaid || 0,
      balanceAmount,
      paymentStatus,
      bankDetails,
      createdBy: req.user._id,
      owner: ownerId,
    });

    // If created from quotation, mark quotation as converted
    if (quotationId) {
      await Quotation.findByIdAndUpdate(quotationId, { status: 'Converted' });
    }

    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;
    const invoices = await Invoice.find({ owner: ownerId })
      .populate('lead', 'name email phone address')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createInvoice, getInvoices };
