import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Mod } from '../src/models/Mod';
import { config } from 'dotenv';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/modsbazaar';

async function testDatabase() {
  try {
    console.log('🔍 Testing database contents...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check users
    const userCount = await User.countDocuments();
    console.log(`👥 Total users: ${userCount}`);
    
    if (userCount > 0) {
      const sampleUser = await User.findOne({ email: 'test@example.com' }).select('-password');
      if (sampleUser) {
        console.log(`👤 Sample user found: ${sampleUser.username}`);
        console.log(`   📧 Email: ${sampleUser.email}`);
        console.log(`   🎮 Gamer tag: ${sampleUser.gamerTag}`);
        console.log(`   ❤️  Favorites: ${sampleUser.favoriteMods.length}`);
        console.log(`   💰 Purchased: ${sampleUser.purchasedMods.length}`);
        console.log(`   📦 Downloads: ${sampleUser.downloadHistory.length}`);
      }
    }

    // Check mods
    const modCount = await Mod.countDocuments();
    console.log(`🎮 Total mods: ${modCount}`);
    
    if (modCount > 0) {
      const sampleMods = await Mod.find().limit(3).select('name type downloads');
      console.log('📋 Sample mods:');
      sampleMods.forEach(mod => {
        console.log(`   🔧 ${mod.name} (${mod.type}) - ${mod.downloads} downloads`);
      });
    }

    console.log('\n✅ Database test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  testDatabase();
}

export { testDatabase };
