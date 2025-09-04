import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Mod } from '../src/models/Mod';
import { config } from 'dotenv';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/modsbazaar';

async function wipeDatabase() {
  try {
    console.log('🧹 Starting database wipe...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get collection statistics before deletion
    const userCount = await User.countDocuments();
    const modCount = await Mod.countDocuments();
    
    console.log(`📊 Current database contents:`);
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Mods: ${modCount}`);

    if (userCount === 0 && modCount === 0) {
      console.log('ℹ️  Database is already empty');
      return;
    }

    // Confirm deletion (in production, you might want to add a confirmation prompt)
    console.log('\n⚠️  WARNING: This will permanently delete ALL data!');
    
    // Delete all data
    console.log('🗑️  Deleting all users...');
    const deletedUsers = await User.deleteMany({});
    console.log(`✅ Deleted ${deletedUsers.deletedCount} users`);

    console.log('🗑️  Deleting all mods...');
    const deletedMods = await Mod.deleteMany({});
    console.log(`✅ Deleted ${deletedMods.deletedCount} mods`);

    // Drop indexes to reset everything
    console.log('🔧 Resetting database indexes...');
    try {
      await User.collection.dropIndexes();
      await Mod.collection.dropIndexes();
      console.log('✅ Indexes reset');
    } catch (error) {
      console.log('ℹ️  No indexes to drop (database was empty)');
    }

    console.log('\n🎉 Database wipe completed successfully!');
    console.log('💡 Tip: Run "npm run seed" to populate with sample data');

  } catch (error) {
    console.error('❌ Error wiping database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the wiper
if (require.main === module) {
  wipeDatabase();
}

export { wipeDatabase };
