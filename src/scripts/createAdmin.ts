import dotenv from 'dotenv';
import { connectDB } from '../config/database';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    await connectDB();
    console.log('📦 Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      console.log('User details:', {
        id: existingAdmin._id,
        username: existingAdmin.username,
        email: existingAdmin.email,
        role: existingAdmin.role,
        isActive: existingAdmin.isActive,
        isVerified: existingAdmin.isVerified,
        isBanned: existingAdmin.isBanned
      });
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@modsbazaar.com',
      password: 'admin123', // This will be hashed by the pre-save middleware
      role: 'admin',
      isVerified: true,
      isActive: true,
      favoriteGame: 'Both',
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          newMods: true,
          updates: true
        },
        privacy: {
          showProfile: true,
          showDownloads: false
        }
      }
    });

    await adminUser.save();
    console.log('🚀 Admin user created successfully!');
    console.log('Login credentials:');
    console.log('Email: admin@modsbazaar.com');
    console.log('Password: admin123');
    console.log('Role: admin');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
};

// Run the script
createAdminUser();
