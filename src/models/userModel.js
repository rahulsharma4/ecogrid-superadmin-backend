const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['superadmin', 'admin', 'staff', 'telecaller'],
      default: 'staff',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    companyDetails: {
      companyName: { type: String, default: 'Solar Hub' },
      companyLogo: { type: String, default: '' },
      themeColor: { type: String, default: '#3f7abe' },
      themeColorSecondary: { type: String, default: '#f6871e' },
      supportEmail: { type: String, default: 'support@solarhub.com' },
      supportPhone: { type: String, default: '+91-9999999999' },
      companyAddress: { type: String, default: '123 Green Energy Lane, New Delhi, India' },
      gstNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      bankAccountNo: { type: String, default: '' },
      bankIfsc: { type: String, default: '' },
      companySeal: { type: String, default: '' },
      authorizedSignature: { type: String, default: '' },
      websiteUrl: { type: String, default: 'www.solarhub.com' },
      upiId: { type: String, default: 'solarhub@upi' },
      payeeName: { type: String, default: 'SOLAR HUB PRIVATE LIMITED' },
      signatoryDesignation: { type: String, default: 'Authorized Signatory' },
      panNumber: { type: String, default: '' },
      companyShortName: { type: String, default: 'SH' },
      whatsappNumber: { type: String, default: '+91-9999999999' },
      termsAndConditions: { type: String, default: '1. Interest @18% will be charged if payment is not made within due date.\n2. All disputes are subject to local jurisdiction.' },
      paymentQrCode: { type: String, default: '' },
      whatsappQrCode: { type: String, default: '' },
      companyTagline: { type: String, default: 'Powering the Solar Revolution.' },
      companyDescription: { type: String, default: 'Access the Command Center to manage your sustainable energy infrastructure.' },
      companySubHeader: { type: String, default: 'Solar Command' },
    },
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  try {
    // Using 8 rounds for a balance between security and speed on all systems
    this.password = await bcrypt.hash(this.password, 8);
  } catch (error) {
    throw error;
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
