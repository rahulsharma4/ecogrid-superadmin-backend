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
      inverterHybrid, battery, batteryRemark,
      baseAmount, earlyBirdDiscount, additionalDiscount, gstPercentage,
      centralSubsidy, stateSubsidy, terms, bankDetails, loanDetails, validUntil,
      isGstInclusive
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
    const isInclusive = isGstInclusive === true || isGstInclusive === 'true';
    const gstPerc = isInclusive ? 8.9 : (Number(gstPercentage) || 0);
    const centralSub = Number(centralSubsidy) || 0;
    const stateSub = Number(stateSubsidy) || 0;

    const totalDiscount = earlyDisc + addDisc;
    const amountAfterDiscount = Math.max(0, baseAmt - totalDiscount);
    
    let gstAmt = 0;
    let netPriceAmt = 0;
    if (isInclusive) {
      gstAmt = (amountAfterDiscount * 8.9) / 108.9;
      netPriceAmt = amountAfterDiscount;
    } else {
      gstAmt = (amountAfterDiscount * gstPerc) / 100;
      netPriceAmt = amountAfterDiscount + gstAmt;
    }

    const netEffectivePriceAmt = Math.max(0, netPriceAmt - centralSub - stateSub);

    const ownerId = req.user.role === 'admin' ? req.user._id : req.user.owner;

    const quotation = await Quotation.create({
      ...req.body,
      lead: leadId,
      quotationNo,
      systemSize: systemSize || 'N/A',
      solarPanels: solarPanels || 'N/A',
      inverter: inverter || 'N/A',
      structureType: structureType || '',
      offering: offering || 'Solar Hub',
      gsmBased: gsmBased || 'No',
      cleaningFrequency: cleaningFrequency || 'NO',
      floorHeight: floorHeight || '',
      inverterLocation: inverterLocation || 'Ground',
      inverterHybrid: inverterHybrid || 'No',
      battery: battery || 'No',
      batteryRemark: batteryRemark || '',
      baseAmount: baseAmt,
      earlyBirdDiscount: earlyDisc,
      additionalDiscount: addDisc,
      gstPercentage: gstPerc,
      gstAmount: gstAmt,
      isGstInclusive: isInclusive,
      netPrice: netPriceAmt,
      centralSubsidy: centralSub,
      stateSubsidy: stateSub,
      netEffectivePrice: netEffectivePriceAmt,
      terms: terms || '',
      bankDetails: bankDetails || {},
      loanDetails: loanDetails || {},
      validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

// @desc    Update quotation details
// @route   PUT /api/quotations/:id
// @access  Private
const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (quotation.status === 'Converted') {
      return res.status(400).json({ message: 'Converted quotation cannot be edited' });
    }

    const {
      systemSize, solarPanels, inverter, structureType,
      offering, gsmBased, cleaningFrequency, floorHeight, inverterLocation,
      inverterHybrid, battery, batteryRemark,
      baseAmount, earlyBirdDiscount, additionalDiscount, gstPercentage,
      centralSubsidy, stateSubsidy, terms, bankDetails, loanDetails, validUntil,
      isGstInclusive
    } = req.body;

    // Calculations
    const baseAmt = Number(baseAmount) || 0;
    const earlyDisc = Number(earlyBirdDiscount) || 0;
    const addDisc = Number(additionalDiscount) || 0;
    const isInclusive = isGstInclusive === true || isGstInclusive === 'true';
    const gstPerc = isInclusive ? 8.9 : (Number(gstPercentage) || 0);
    const centralSub = Number(centralSubsidy) || 0;
    const stateSub = Number(stateSubsidy) || 0;

    const totalDiscount = earlyDisc + addDisc;
    const amountAfterDiscount = Math.max(0, baseAmt - totalDiscount);
    
    let gstAmt = 0;
    let netPriceAmt = 0;
    if (isInclusive) {
      gstAmt = (amountAfterDiscount * 8.9) / 108.9;
      netPriceAmt = amountAfterDiscount;
    } else {
      gstAmt = (amountAfterDiscount * gstPerc) / 100;
      netPriceAmt = amountAfterDiscount + gstAmt;
    }

    const netEffectivePriceAmt = Math.max(0, netPriceAmt - centralSub - stateSub);

    // Update technical and specs details
    quotation.systemSize = systemSize || quotation.systemSize;
    quotation.solarPanels = solarPanels || quotation.solarPanels;
    if (req.body.solarPanelsMake !== undefined) quotation.solarPanelsMake = req.body.solarPanelsMake;
    if (req.body.solarPanelsQty !== undefined) quotation.solarPanelsQty = req.body.solarPanelsQty;
    
    quotation.inverter = inverter || quotation.inverter;
    if (req.body.inverterMake !== undefined) quotation.inverterMake = req.body.inverterMake;
    if (req.body.inverterQty !== undefined) quotation.inverterQty = req.body.inverterQty;

    quotation.structureType = structureType !== undefined ? structureType : quotation.structureType;
    if (req.body.structureMake !== undefined) quotation.structureMake = req.body.structureMake;
    if (req.body.structureQty !== undefined) quotation.structureQty = req.body.structureQty;

    if (req.body.acdbDetails !== undefined) quotation.acdbDetails = req.body.acdbDetails;
    if (req.body.acdbMake !== undefined) quotation.acdbMake = req.body.acdbMake;
    if (req.body.acdbQty !== undefined) quotation.acdbQty = req.body.acdbQty;

    if (req.body.dcdbDetails !== undefined) quotation.dcdbDetails = req.body.dcdbDetails;
    if (req.body.dcdbMake !== undefined) quotation.dcdbMake = req.body.dcdbMake;
    if (req.body.dcdbQty !== undefined) quotation.dcdbQty = req.body.dcdbQty;

    if (req.body.earthingDetails !== undefined) quotation.earthingDetails = req.body.earthingDetails;
    if (req.body.earthingMake !== undefined) quotation.earthingMake = req.body.earthingMake;
    if (req.body.earthingQty !== undefined) quotation.earthingQty = req.body.earthingQty;

    if (req.body.wiringDetails !== undefined) quotation.wiringDetails = req.body.wiringDetails;
    if (req.body.wiringMake !== undefined) quotation.wiringMake = req.body.wiringMake;
    if (req.body.wiringQty !== undefined) quotation.wiringQty = req.body.wiringQty;

    if (req.body.cablesDetails !== undefined) quotation.cablesDetails = req.body.cablesDetails;
    if (req.body.cablesMake !== undefined) quotation.cablesMake = req.body.cablesMake;
    if (req.body.cablesQty !== undefined) quotation.cablesQty = req.body.cablesQty;

    if (req.body.lightningDetails !== undefined) quotation.lightningDetails = req.body.lightningDetails;
    if (req.body.lightningMake !== undefined) quotation.lightningMake = req.body.lightningMake;
    if (req.body.lightningQty !== undefined) quotation.lightningQty = req.body.lightningQty;

    if (req.body.installationDetails !== undefined) quotation.installationDetails = req.body.installationDetails;
    if (req.body.installationMake !== undefined) quotation.installationMake = req.body.installationMake;
    if (req.body.installationQty !== undefined) quotation.installationQty = req.body.installationQty;

    quotation.offering = offering || quotation.offering;
    quotation.gsmBased = gsmBased || quotation.gsmBased;
    quotation.cleaningFrequency = cleaningFrequency || quotation.cleaningFrequency;
    quotation.floorHeight = floorHeight !== undefined ? floorHeight : quotation.floorHeight;
    quotation.inverterLocation = inverterLocation || quotation.inverterLocation;
    quotation.inverterHybrid = inverterHybrid || quotation.inverterHybrid;
    quotation.battery = battery || quotation.battery;
    quotation.batteryRemark = batteryRemark !== undefined ? batteryRemark : quotation.batteryRemark;

    quotation.baseAmount = baseAmt;
    quotation.earlyBirdDiscount = earlyDisc;
    quotation.additionalDiscount = addDisc;
    quotation.gstPercentage = gstPerc;
    quotation.gstAmount = gstAmt;
    quotation.isGstInclusive = isInclusive;
    quotation.netPrice = netPriceAmt;
    quotation.centralSubsidy = centralSub;
    quotation.stateSubsidy = stateSub;
    quotation.netEffectivePrice = netEffectivePriceAmt;
    
    quotation.terms = terms || quotation.terms;
    if (bankDetails) quotation.bankDetails = bankDetails;
    if (loanDetails) quotation.loanDetails = loanDetails;
    if (validUntil) quotation.validUntil = validUntil;

    const updatedQuotation = await quotation.save();

    // Also update Lead quotationAmount
    await Lead.findByIdAndUpdate(quotation.lead, {
      quotationAmount: netPriceAmt
    });

    res.json(updatedQuotation);
  } catch (error) {
    console.error('Quotation Update Error:', error);
    res.status(400).json({ message: error.message || 'Failed to update quotation' });
  }
};

module.exports = { createQuotation, getQuotations, getQuotationById, updateQuotation };
