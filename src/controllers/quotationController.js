const Quotation = require('../models/quotationModel');
const Lead = require('../models/leadModel');

// @desc    Create a new quotation
// @route   POST /api/quotations
// @access  Private
const createQuotation = async (req, res) => {
  try {
    const { 
      leadId, systemSize, solarPanels, inverter, structureType, 
      offering, gsmBased, cleaningFrequency, floorHeight, inverterLocation,
      baseAmount, earlyBirdDiscount, additionalDiscount, gstPercentage,
      centralSubsidy, stateSubsidy, terms, bankDetails, loanDetails, validUntil
    } = req.body;

    // Generate Quotation Number (e.g. Q-2026-0001)
    const year = new Date().getFullYear();
    const lastQuotation = await Quotation.findOne({
        quotationNo: new RegExp(`^Q-${year}-`)
    }).sort({ quotationNo: -1 });

    let nextNumber = 1;
    if (lastQuotation) {
        const lastNo = parseInt(lastQuotation.quotationNo.split('-')[2]);
        nextNumber = lastNo + 1;
    }
    const quotationNo = `Q-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Calculations
    const baseAmt = Number(baseAmount) || 0;
    const earlyDisc = Number(earlyBirdDiscount) || 0;
    const addDisc = Number(additionalDiscount) || 0;
    const gstPerc = Number(gstPercentage) || 0;
    const centralSub = Number(centralSubsidy) || 0;
    const stateSub = Number(stateSubsidy) || 0;

    const totalDiscount = earlyDisc + addDisc;
    const amountAfterDiscount = Math.max(0, baseAmt - totalDiscount);
    const gstAmt = (amountAfterDiscount * gstPerc) / 100;
    const netPriceAmt = amountAfterDiscount + gstAmt;
    const netEffectivePriceAmt = netPriceAmt; // Subsidies no longer affect the final amount

    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;

    const quotation = await Quotation.create({
      lead: leadId,
      quotationNo,
      systemSize: systemSize || 'N/A',
      solarPanels: solarPanels || 'N/A',
      inverter: inverter || 'N/A',
      structureType: structureType || '',
      offering: offering || 'ZenPro',
      gsmBased: gsmBased || 'No',
      cleaningFrequency: cleaningFrequency || 'NO',
      floorHeight: floorHeight || '',
      inverterLocation: inverterLocation || 'Ground',
      baseAmount: baseAmt,
      earlyBirdDiscount: earlyDisc,
      additionalDiscount: addDisc,
      gstPercentage: gstPerc,
      gstAmount: gstAmt,
      netPrice: netPriceAmt,
      centralSubsidy: centralSub,
      stateSubsidy: stateSub,
      netEffectivePrice: netEffectivePriceAmt,
      terms: terms || '',
      bankDetails: bankDetails || {},
      loanDetails: loanDetails || {},
      validUntil: validUntil || new Date(Date.now() + 30*24*60*60*1000),
      createdBy: req.user._id,
      owner: ownerId,
    });

    // Update Lead status and amount
    await Lead.findByIdAndUpdate(leadId, {
      status: 'Quotation Sent',
      quotationAmount: netPriceAmt
    });

    res.status(201).json(quotation);
  } catch (error) {
    console.error('Quotation Creation Error:', error);
    res.status(400).json({ message: error.message || 'Failed to create quotation' });
  }
};

// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Private
const getQuotations = async (req, res) => {
  try {
    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;
    const quotations = await Quotation.find({ owner: ownerId })
      .populate('lead', 'name email phone address')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Private
const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('lead', 'name email phone address')
      .populate('createdBy', 'name');
    
    if (quotation) {
      res.json(quotation);
    } else {
      res.status(404).json({ message: 'Quotation not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createQuotation, getQuotations, getQuotationById };
