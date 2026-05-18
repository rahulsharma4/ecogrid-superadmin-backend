const mongoose = require('mongoose');

const leadSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    solarCapacity: {
      type: String, // e.g., "5kW"
    },
    roofType: {
      type: String, // e.g., "Concrete", "Tin Shade"
    },
    propertyType: {
      type: String, // e.g., "Residential", "Commercial"
    },
    companyName: { type: String },
    companyAddress: { type: String },
    gstNumber: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['New', 'Contacted', 'Follow-up Scheduled', 'Site Visit Scheduled', 'Meeting Done', 'Quotation Sent', 'Booked', 'Installation Underway', 'Completed', 'Cancelled', 'Closed'],
      default: 'New',
    },
    source: {
      type: String,
      default: 'Direct',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followUpDate: {
      type: Date,
    },
    followUpStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Missed'],
      default: 'Pending',
    },
    followUpRemarks: {
      type: String,
    },
    quotationAmount: {
      type: Number,
      default: 0,
    },
    technicalRemarks: {
      type: String,
    },
    history: [
      {
        status: String,
        comment: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    personalInfo: {
      profileImage: { type: String }, // Base64 (Primary)
      additionalImages: [{ type: String }], // Array of Base64 strings
      alternatePhone: { type: String },
      whatsappNumber: { type: String },
      gender: { type: String, enum: ['Male', 'Female', 'Other'] },
      occupation: { type: String },
      dob: { type: Date },
      aadhaarNumber: { type: String },
      panNumber: { type: String },
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

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
