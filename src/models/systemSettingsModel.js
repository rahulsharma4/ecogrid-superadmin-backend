const mongoose = require('mongoose');

const systemSettingsSchema = mongoose.Schema(
  {
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    allowNewAdminRegistration: {
      type: Boolean,
      default: true,
    },
    installationTargetkW: {
      type: Number,
      default: 1000,
    },
    contactEmail: {
      type: String,
      default: 'support@ecogrid.com',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
