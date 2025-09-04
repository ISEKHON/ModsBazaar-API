import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Mod } from '../src/models/Mod';
import { config } from 'dotenv';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://testdb:testDB@cluster0.6tn135l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Sample user data
const sampleUsers = [
  {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPass123',
    gamerTag: 'testuser',
    favoriteGame: 'Both',
    isVerified: true,
    role: 'user',
    lastPasswordChange: new Date('2024-08-01T10:00:00Z')
  },
  {
    username: 'farmerpro',
    email: 'farmer@example.com',
    password: 'FarmPass123',
    gamerTag: 'FarmMaster',
    favoriteGame: 'FS25',
    isVerified: true,
    role: 'user',
    lastPasswordChange: new Date('2024-08-15T14:30:00Z')
  },
  {
    username: 'modlover',
    email: 'modlover@example.com',
    password: 'ModPass123',
    gamerTag: 'ModLover2024',
    favoriteGame: 'FS22',
    isVerified: true,
    role: 'user',
    lastPasswordChange: new Date('2024-09-01T09:15:00Z')
  }
];

// Sample mod data
const sampleMods = [
  {
    name: 'John Deere 8R Series Premium',
    slug: 'john-deere-8r-series-premium',
    description: 'Highly detailed John Deere 8R series tractor with authentic sounds, realistic physics, and premium interior. Features include multiple wheel configurations, front loader compatibility, and precision farming ready systems.',
    shortDescription: 'Premium John Deere 8R series tractor with authentic details',
    type: 'paid',
    price: 9.99,
    version: '1.2.0',
    game: 'Both',
    category: 'Tractors',
    tags: ['john-deere', '8r', 'premium', 'tractor', 'realistic'],
    thumbnail: '/images/mods/john-deere-8r-thumb.jpg',
    screenshots: [
      '/images/mods/john-deere-8r-1.jpg',
      '/images/mods/john-deere-8r-2.jpg',
      '/images/mods/john-deere-8r-3.jpg'
    ],
    files: [{
      name: 'JohnDeere8R.zip',
      size: '45.2 MB',
      downloadUrl: '/downloads/johndeere8r.zip',
      uploadedAt: new Date()
    }],
    downloads: 1547,
    views: 3892,
    rating: 4.8,
    ratingCount: 23,
    isActive: true,
    isFeatured: true,
    isPopular: true,
    publishedAt: new Date('2024-08-15'),
    requirements: {
      minVersion: '1.0.0',
      maxVersion: '2.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['john deere', '8r series', 'tractor', 'farming'],
    reviews: [
      {
        username: 'farmerpro',
        rating: 5,
        comment: 'Amazing detail and realistic handling. Worth every penny!',
        createdAt: new Date('2024-08-20'),
        isVerified: true
      },
      {
        username: 'modlover',
        rating: 4,
        comment: 'Great mod but could use more paint options.',
        createdAt: new Date('2024-08-22'),
        isVerified: true
      }
    ]
  },
  {
    name: 'Claas Lexion 8900 Combine',
    slug: 'claas-lexion-8900-combine',
    description: 'Professional grade Claas Lexion 8900 combine harvester with advanced threshing systems, GPS guidance, and authentic cabin experience. Perfect for large-scale farming operations.',
    shortDescription: 'Professional Claas Lexion 8900 combine harvester',
    type: 'paid',
    price: 12.99,
    version: '1.0.3',
    game: 'FS25',
    category: 'Harvesters',
    tags: ['claas', 'lexion', 'combine', 'harvester', 'professional'],
    thumbnail: '/images/mods/claas-lexion-thumb.jpg',
    screenshots: [
      '/images/mods/claas-lexion-1.jpg',
      '/images/mods/claas-lexion-2.jpg'
    ],
    files: [{
      name: 'ClaasLexion8900.zip',
      size: '62.1 MB',
      downloadUrl: '/downloads/claaslexion8900.zip',
      uploadedAt: new Date()
    }],
    downloads: 892,
    views: 2341,
    rating: 4.9,
    ratingCount: 17,
    isActive: true,
    isFeatured: true,
    publishedAt: new Date('2024-08-10'),
    requirements: {
      minVersion: '1.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['claas', 'lexion', 'combine', 'harvester'],
    reviews: [
      {
        username: 'testuser',
        rating: 5,
        comment: 'Best combine mod I\'ve used! Excellent quality.',
        createdAt: new Date('2024-08-12'),
        isVerified: true
      }
    ]
  },
  {
    name: 'Premium Tractor Pack v2',
    slug: 'premium-tractor-pack-v2',
    description: 'Complete collection of 15 premium tractors from various manufacturers. Includes Fendt, New Holland, Case IH, and more. Each tractor features unique characteristics and configurations.',
    shortDescription: 'Collection of 15 premium tractors from top manufacturers',
    type: 'paid',
    price: 19.99,
    version: '2.1.0',
    game: 'Both',
    category: 'Vehicles',
    tags: ['pack', 'tractors', 'fendt', 'case-ih', 'new-holland', 'premium'],
    thumbnail: '/images/mods/premium-pack-thumb.jpg',
    screenshots: [
      '/images/mods/premium-pack-1.jpg',
      '/images/mods/premium-pack-2.jpg',
      '/images/mods/premium-pack-3.jpg'
    ],
    files: [{
      name: 'PremiumTractorPack.zip',
      size: '156.7 MB',
      downloadUrl: '/downloads/premiumtractorpack.zip',
      uploadedAt: new Date()
    }],
    downloads: 2156,
    views: 5678,
    rating: 4.7,
    ratingCount: 45,
    isActive: true,
    isFeatured: true,
    isPopular: true,
    publishedAt: new Date('2024-07-28'),
    requirements: {
      minVersion: '1.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['tractor pack', 'premium', 'collection'],
    reviews: [
      {
        username: 'farmerpro',
        rating: 5,
        comment: 'Incredible value! 15 high-quality tractors.',
        createdAt: new Date('2024-08-01'),
        isVerified: true
      },
      {
        username: 'modlover',
        rating: 4,
        comment: 'Great variety, some tractors could use minor fixes.',
        createdAt: new Date('2024-08-05'),
        isVerified: true
      }
    ]
  },
  {
    name: 'Massey Ferguson 8S Series',
    slug: 'massey-ferguson-8s-series',
    description: 'Free high-quality Massey Ferguson 8S series tractor. Features realistic engine sounds, detailed interior, and multiple wheel options. Perfect for medium to large farming operations.',
    shortDescription: 'Free Massey Ferguson 8S series tractor',
    type: 'free',
    version: '1.1.2',
    game: 'FS22',
    category: 'Tractors',
    tags: ['massey-ferguson', '8s', 'free', 'tractor'],
    thumbnail: '/images/mods/massey-8s-thumb.jpg',
    screenshots: [
      '/images/mods/massey-8s-1.jpg',
      '/images/mods/massey-8s-2.jpg'
    ],
    files: [{
      name: 'MasseyFerguson8S.zip',
      size: '38.4 MB',
      downloadUrl: '/downloads/masseyferguson8s.zip',
      uploadedAt: new Date()
    }],
    downloads: 3421,
    views: 7892,
    rating: 4.6,
    ratingCount: 67,
    isActive: true,
    publishedAt: new Date('2024-09-01'),
    requirements: {
      minVersion: '1.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['massey ferguson', '8s series', 'free', 'tractor'],
    reviews: [
      {
        username: 'testuser',
        rating: 5,
        comment: 'Amazing quality for a free mod! Thank you!',
        createdAt: new Date('2024-09-02'),
        isVerified: true
      }
    ]
  },
  {
    name: 'Exclusive Fendt 1000 Vario',
    slug: 'exclusive-fendt-1000-vario',
    description: 'Unlock-exclusive Fendt 1000 Vario with premium features, custom paint jobs, and advanced precision farming capabilities. Only available with special unlock code.',
    shortDescription: 'Exclusive Fendt 1000 Vario with premium features',
    type: 'unlock',
    unlockCode: 'FENDT1000PREMIUM',
    version: '1.0.0',
    game: 'Both',
    category: 'Tractors',
    tags: ['fendt', '1000-vario', 'exclusive', 'premium', 'unlock'],
    thumbnail: '/images/mods/fendt-1000-thumb.jpg',
    screenshots: [
      '/images/mods/fendt-1000-1.jpg',
      '/images/mods/fendt-1000-2.jpg'
    ],
    files: [{
      name: 'FendtVario1000.zip',
      size: '52.3 MB',
      downloadUrl: '/downloads/fendtvario1000.zip',
      uploadedAt: new Date()
    }],
    downloads: 234,
    views: 1456,
    rating: 4.9,
    ratingCount: 8,
    isActive: true,
    publishedAt: new Date('2024-08-25'),
    requirements: {
      minVersion: '1.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['fendt', '1000 vario', 'exclusive', 'unlock'],
    reviews: [
      {
        username: 'farmerpro',
        rating: 5,
        comment: 'Exclusive features are incredible! Worth the unlock.',
        createdAt: new Date('2024-08-26'),
        isVerified: true
      }
    ]
  },
  {
    name: 'Claas Arion 600 Series',
    slug: 'claas-arion-600-series',
    description: 'Free Claas Arion 600 series tractor with authentic design and realistic performance. Great for beginners and experienced farmers alike.',
    shortDescription: 'Free Claas Arion 600 series tractor',
    type: 'free',
    version: '1.0.1',
    game: 'Both',
    category: 'Tractors',
    tags: ['claas', 'arion', '600', 'free', 'beginner-friendly'],
    thumbnail: '/images/mods/claas-arion-thumb.jpg',
    screenshots: [
      '/images/mods/claas-arion-1.jpg'
    ],
    files: [{
      name: 'ClaasArion600.zip',
      size: '29.8 MB',
      downloadUrl: '/downloads/claasarion600.zip',
      uploadedAt: new Date()
    }],
    downloads: 2876,
    views: 5432,
    rating: 4.3,
    ratingCount: 34,
    isActive: true,
    publishedAt: new Date('2024-08-12'),
    requirements: {
      minVersion: '1.0.0',
      dependencies: [],
      conflicts: []
    },
    keywords: ['claas', 'arion 600', 'free', 'tractor'],
    reviews: []
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Mod.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create admin user first (you)
    console.log('👤 Creating admin user...');
    const adminUser = new User({
      username: 'ModsBazaar',
      email: 'admin@modsbazaar.com',
      password: 'AdminPass123',
      gamerTag: 'ModsBazaar',
      favoriteGame: 'Both',
      isVerified: true,
      role: 'admin',
      lastPasswordChange: new Date('2024-07-01T00:00:00Z'),
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          newMods: true,
          updates: true
        },
        privacy: {
          showProfile: true,
          showDownloads: true
        }
      }
    });
    
    // Clear any existing mod references
    adminUser.favoriteMods = [];
    adminUser.purchasedMods = [];
    
    await adminUser.save();
    console.log('✅ Admin user created');

    // Create sample users
    console.log('👥 Creating sample users...');
    const createdUsers: any[] = [];
    for (const userData of sampleUsers) {
      const user = new User({
        ...userData,
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
      await user.save();
      createdUsers.push(user);
      console.log(`  ✅ Created user: ${user.username}`);
    }

    // Create sample mods
    console.log('🎮 Creating sample mods...');
    const createdMods: any[] = [];
    for (const modData of sampleMods) {
      // Add user IDs to reviews
      const modWithUserIds = {
        ...modData,
        author: {
          name: 'ModsBazaar',
          id: adminUser._id
        },
        reviews: modData.reviews.map(review => {
          const user = createdUsers.find(u => u.username === review.username);
          return {
            ...review,
            userId: user?._id || adminUser._id
          };
        })
      };

      const mod = new Mod(modWithUserIds);
      await mod.save();
      createdMods.push(mod);
      console.log(`  ✅ Created mod: ${mod.name}`);
    }

    // Add some purchases and favorites to users
    console.log('💰 Adding purchases and favorites...');
    
    // Clear existing mod references for all users first
    console.log('🧹 Clearing existing user mod references...');
    for (const user of createdUsers) {
      user.purchasedMods = [];
      user.unlockedMods = [];
      user.favoriteMods = [];
      user.downloadHistory = [];
    }
    
    // Test user purchases John Deere and Premium Pack
    const testUser = createdUsers.find(u => u.username === 'testuser');
    if (testUser) {
      const johnDeereMod = createdMods.find(m => m.name.includes('John Deere'));
      const premiumPack = createdMods.find(m => m.name.includes('Premium Tractor Pack'));
      const fendtMod = createdMods.find(m => m.name.includes('Fendt 1000'));
      
      if (johnDeereMod) {
        testUser.purchasedMods.push(johnDeereMod._id as any);
        testUser.favoriteMods.push(johnDeereMod._id as any);
      }
      if (premiumPack) {
        testUser.purchasedMods.push(premiumPack._id as any);
      }
      if (fendtMod) {
        testUser.unlockedMods.push(fendtMod._id as any);
        testUser.favoriteMods.push(fendtMod._id as any);
      }
      
      // Add download history
      testUser.downloadHistory = [
        {
          modId: johnDeereMod?._id as any,
          modName: johnDeereMod?.name || '',
          downloadedAt: new Date('2024-08-15'),
          downloadCount: 3,
          type: 'purchased'
        },
        {
          modId: createdMods.find(m => m.name.includes('Massey'))?._id as any,
          modName: 'Massey Ferguson 8S Series',
          downloadedAt: new Date('2024-09-01'),
          downloadCount: 1,
          type: 'free'
        },
        {
          modId: createdMods.find(m => m.name.includes('Claas Arion'))?._id as any,
          modName: 'Claas Arion 600 Series',
          downloadedAt: new Date('2024-08-12'),
          downloadCount: 1,
          type: 'free'
        }
      ];
      
      await testUser.save();
      console.log('  ✅ Added purchases and favorites for testuser');
    }

    // Farmer user purchases Claas combine
    const farmerUser = createdUsers.find(u => u.username === 'farmerpro');
    if (farmerUser) {
      const claasCombine = createdMods.find(m => m.name.includes('Claas Lexion'));
      if (claasCombine) {
        farmerUser.purchasedMods.push(claasCombine._id as any);
        farmerUser.favoriteMods.push(claasCombine._id as any);
      }
      await farmerUser.save();
      console.log('  ✅ Added purchases for farmerpro');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - 1 admin user (ModsBazaar)`);
    console.log(`   - ${createdUsers.length} sample users`);
    console.log(`   - ${createdMods.length} sample mods`);
    console.log(`   - Sample purchases and download history`);
    
    console.log('\n🔑 Test Credentials:');
    console.log('   Admin: admin@modsbazaar.com / AdminPass123');
    console.log('   User: test@example.com / TestPass123');
    console.log('   User: farmer@example.com / FarmPass123');
    console.log('   User: modlover@example.com / ModPass123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };
