const User = require('../models/userModel');
const SystemSettings = require('../models/systemSettingsModel');

const seedSuperAdmin = async () => {
  try {
    // 1. Seed Super Admin user
    const superAdminEmail = 'superadmin@ecogrid.com';
    const superAdminExists = await User.findOne({ email: superAdminEmail });

    if (!superAdminExists) {
      const superAdmin = new User({
        name: 'Super Admin',
        email: superAdminEmail,
        password: 'superadmin123',
        phone: '9999999999',
        role: 'superadmin',
        status: 'active',
      });
      await superAdmin.save();
      console.log('Seeder: Default Super Admin account successfully created (superadmin@ecogrid.com / superadmin123)!');
    } else {
      console.log('Seeder: Super Admin account already verified.');
    }

    // 2. Seed Default System Settings
    const settingsExists = await SystemSettings.findOne();
    if (!settingsExists) {
      const defaultSettings = new SystemSettings({
        maintenanceMode: false,
        allowNewAdminRegistration: true,
        installationTargetkW: 1200,
        contactEmail: 'support@ecogrid.com',
      });
      await defaultSettings.save();
      console.log('Seeder: Default System Settings created!');
    }
  } catch (error) {
    console.error(`Seeder Error: ${error.message}`);
  }
};

module.exports = { seedSuperAdmin };
