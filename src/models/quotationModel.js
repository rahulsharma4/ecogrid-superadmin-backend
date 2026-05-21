const mongoose = require('mongoose');

const quotationSchema = mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    quotationNo: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    // Technical Specs (from Image 1)
    systemSize: { type: String, required: true }, // e.g. "4.34 kWp"
    solarPanels: { type: String, required: true }, // e.g. "Adani - 620 Wp [7 panels]"
    solarPanelsMake: { type: String, default: 'Adani/Luminous' },
    solarPanelsQty: { type: String, default: 'As per capacity' },
    inverter: { type: String, required: true }, // e.g. "Polycab - 5 kW (Single Phase)"
    inverterMake: { type: String, default: 'Solis' },
    inverterQty: { type: String, default: '1 Unit' },
    structureType: { type: String }, // e.g. "Elevated"
    structureMake: { type: String, default: 'Approved Make' },
    structureQty: { type: String, default: 'For panels' },

    // Additional table rows
    acdbDetails: { type: String, default: 'For Safe AC Distribution, IP65' },
    acdbMake: { type: String, default: 'Polycab' },
    acdbQty: { type: String, default: '1 Unit' },

    dcdbDetails: { type: String, default: 'For Safe DC Distribution, IP65' },
    dcdbMake: { type: String, default: 'Polycab' },
    dcdbQty: { type: String, default: '1 Unit' },

    earthingDetails: { type: String, default: 'Standard earthing for electrical safety' },
    earthingMake: { type: String, default: 'True Power' },
    earthingQty: { type: String, default: '3 Unit' },

    wiringDetails: { type: String, default: 'For safe and secure wiring' },
    wiringMake: { type: String, default: '' },
    wiringQty: { type: String, default: 'As per Requirement' },

    cablesDetails: { type: String, default: 'Cu wire 4mm' },
    cablesMake: { type: String, default: 'Polycab' },
    cablesQty: { type: String, default: '1 Set' },

    lightningDetails: { type: String, default: 'Safely grounds lighting, protecting structure and equipment.' },
    lightningMake: { type: String, default: 'Approved Make' },
    lightningQty: { type: String, default: '1 Set' },

    installationDetails: { type: String, default: 'Complete Installation & Setup' },
    installationMake: { type: String, default: '' },
    installationQty: { type: String, default: 'Each' },

    offering: { type: String }, // e.g. "EcoGrid"
    gsmBased: { type: String, default: 'No' },
    cleaningFrequency: { type: String, default: 'NO' },
    floorHeight: { type: String }, // e.g. "G+0"
    inverterLocation: { type: String }, // e.g. "Ground"

    // Pricing (from Image 1 & 2)
    baseAmount: { type: Number, required: true }, // Rooftop System Cost
    earlyBirdDiscount: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    gstPercentage: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    isGstInclusive: { type: Boolean, default: false },
    netPrice: { type: Number, required: true }, // (Base - Discounts + GST)

    // Subsidies
    centralSubsidy: { type: Number, default: 0 }, // Central Govt DBT
    stateSubsidy: { type: Number, default: 0 }, // State Subsidy (UPNEEDA)
    netEffectivePrice: { type: Number, required: true }, // (Net Price - Subsidies)

    terms: { type: String },
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
    },
    loanDetails: {
      required: { type: Boolean, default: false },
      bankName: { type: String },
      bankAddress: { type: String },
      loanAmount: { type: Number },
      tenureMonths: { type: Number },
      interestRate: { type: Number },
      emiAmount: { type: Number },
      processingFees: { type: Number },
      downPayment: { type: Number },
      remarks: { type: String },
    },
    status: {
      type: String,
      enum: ['Pending', 'Converted', 'Cancelled'],
      default: 'Pending',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Quotation = mongoose.model('Quotation', quotationSchema);

module.exports = Quotation;
