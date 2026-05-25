const User = require('../models/userModel');
const SystemSettings = require('../models/systemSettingsModel');

const migrateLegacyBranding = async () => {
  try {
    const users = await User.find({
      $or: [
        { 'companyDetails.companyName': /ecogrid/i },
        { 'companyDetails.supportEmail': /ecogrid/i },
        { 'companyDetails.companyAddress': /ecogrid/i },
        { 'companyDetails.websiteUrl': /ecogrid/i },
        { 'companyDetails.upiId': /ecogrid/i },
        { 'companyDetails.payeeName': /ecogrid/i }
      ]
    });

    for (let user of users) {
      if (user.companyDetails) {
        let modified = false;
        
        const fieldsToMigrate = [
          'companyName',
          'supportEmail',
          'companyAddress',
          'websiteUrl',
          'upiId',
          'payeeName'
        ];

        fieldsToMigrate.forEach(field => {
          if (user.companyDetails[field] && /ecogrid/i.test(user.companyDetails[field])) {
            user.companyDetails[field] = user.companyDetails[field]
              .replace(/ecogridinfra\.in/gi, 'solarhub.com')
              .replace(/ecogrid/gi, 'solarhub')
              .replace(/ECOGRID/gi, 'SOLAR HUB');
            modified = true;
          }
        });

        if (modified) {
          user.markModified('companyDetails');
          await user.save();
          console.log(`Seeder: Migrated legacy EcoGrid branding for user ${user.email}`);
        }
      }
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
};

const seedSuperAdmin = async () => {
  try {
    // Run migration for existing records
    await migrateLegacyBranding();

    // 1. Seed Super Admin user
    const superAdminEmail = 'superadmin@solarhub.com';
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
      console.log('Seeder: Default Super Admin account successfully created (superadmin@solarhub.com / superadmin123)!');
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
        contactEmail: 'support@solarhub.com',
      });
      await defaultSettings.save();
      console.log('Seeder: Default System Settings created!');
    }
  } catch (error) {
    console.error(`Seeder Error: ${error.message}`);
  }
};

module.exports = { seedSuperAdmin };
