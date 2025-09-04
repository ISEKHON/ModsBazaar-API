const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/modsbazaar')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    fixDownloadHistoryTypes();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function fixDownloadHistoryTypes() {
  try {
    console.log('🔍 Searching for users with invalid download history types...');
    
    // Find users with 'paid' type in download history
    const result = await mongoose.connection.db.collection('users').updateMany(
      { 'downloadHistory.type': 'paid' },
      { 
        $set: { 
          'downloadHistory.$[elem].type': 'purchased' 
        }
      },
      {
        arrayFilters: [{ 'elem.type': 'paid' }]
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    console.log(`📊 Matched ${result.matchedCount} users with invalid download history`);

    // Verify the fix
    const remainingInvalid = await mongoose.connection.db.collection('users').countDocuments({
      'downloadHistory.type': 'paid'
    });

    if (remainingInvalid === 0) {
      console.log('✅ All download history types have been fixed!');
    } else {
      console.log(`⚠️  Still ${remainingInvalid} users with invalid types`);
    }

    // Show some stats
    const stats = await mongoose.connection.db.collection('users').aggregate([
      { $unwind: '$downloadHistory' },
      { $group: { _id: '$downloadHistory.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n📈 Download history type distribution:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

  } catch (error) {
    console.error('❌ Error fixing download history types:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📄 Database connection closed');
    process.exit(0);
  }
}
