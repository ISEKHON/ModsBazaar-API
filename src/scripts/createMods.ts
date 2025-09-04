import dotenv from 'dotenv';
import { connectDB } from '../config/database';
import { Mod } from '../models/Mod';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

const sampleMods = [
  {
    name: "Super Harvester 2025",
    description: "The most advanced harvester with realistic physics and improved efficiency. Features include dynamic threshing system, advanced grain handling, and realistic wear mechanics. Perfect for large-scale farming operations with support for multiple crop types.",
    shortDescription: "Advanced harvester with realistic physics and improved efficiency",
    type: "paid",
    price: 4.99,
    version: "1.2.0",
    game: "FS25",
    category: "Vehicles",
    tags: ["harvester", "vehicles", "realistic", "advanced"],
    thumbnail: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&h=600&fit=crop"
    ],
    videoUrl: "https://www.youtube.com/watch?v=example1",
    files: [{
      name: "SuperHarvester2025.zip",
      size: "15.2 MB",
      downloadUrl: "/downloads/super-harvester-2025.zip"
    }],
    requirements: {
      minVersion: "1.0.0",
      dependencies: [],
      conflicts: []
    },
    downloads: 15420,
    views: 28530,
    rating: 4.9,
    ratingCount: 127,
    isActive: true,
    isFeatured: true,
    isPopular: true,
    publishedAt: new Date('2024-12-15'),
    keywords: ["harvester", "farming", "simulator", "vehicle"]
  },
  {
    name: "Mega Farm Pack",
    description: "Complete farming solution with 50+ vehicles and tools. This comprehensive pack includes tractors, harvesters, plows, seeders, and specialized equipment for all your farming needs. Each vehicle features authentic branding and realistic performance characteristics.",
    shortDescription: "Complete farming solution with 50+ vehicles and tools",
    type: "free",
    version: "2.1.0",
    game: "Both",
    category: "Tools",
    tags: ["pack", "vehicles", "tools", "comprehensive"],
    thumbnail: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop"
    ],
    files: [{
      name: "MegaFarmPack.zip",
      size: "124.8 MB",
      downloadUrl: "/downloads/mega-farm-pack.zip"
    }],
    requirements: {
      minVersion: "1.0.0",
      dependencies: [],
      conflicts: []
    },
    downloads: 23150,
    views: 45320,
    rating: 4.8,
    ratingCount: 89,
    isActive: true,
    isFeatured: true,
    isPopular: true,
    publishedAt: new Date('2024-12-10'),
    keywords: ["farm", "pack", "vehicles", "tools"]
  },
  {
    name: "Realistic Weather System",
    description: "Dynamic weather patterns that affect gameplay and crop yields. This advanced mod introduces realistic weather simulation including seasonal changes, precipitation patterns, and temperature variations that directly impact your farming operations.",
    shortDescription: "Dynamic weather patterns that affect gameplay and crop yields",
    type: "unlock",
    unlockCode: "WEATHER2025",
    version: "1.5.3",
    game: "FS25",
    category: "Scripts",
    tags: ["weather", "realistic", "dynamic", "simulation"],
    thumbnail: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop"
    ],
    files: [{
      name: "RealisticWeather.zip",
      size: "8.7 MB",
      downloadUrl: "/downloads/realistic-weather.zip"
    }],
    requirements: {
      minVersion: "1.2.0",
      dependencies: ["ScriptManager"],
      conflicts: []
    },
    downloads: 8750,
    views: 16890,
    rating: 4.7,
    ratingCount: 56,
    isActive: true,
    isFeatured: false,
    isPopular: false,
    publishedAt: new Date('2024-12-12'),
    keywords: ["weather", "dynamic", "realistic", "script"]
  },
  {
    name: "Auto Helper Script",
    description: "Automated farming assistant for repetitive tasks. This intelligent script helps automate routine farming activities like field work, animal care, and resource management, allowing you to focus on strategic decisions.",
    shortDescription: "Automated farming assistant for repetitive tasks",
    type: "free",
    version: "3.0.1",
    game: "Both",
    category: "Scripts",
    tags: ["automation", "helper", "script", "assistant"],
    thumbnail: "https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=800&h=600&fit=crop"
    ],
    videoUrl: "https://www.youtube.com/watch?v=example2",
    files: [{
      name: "AutoHelper.zip",
      size: "2.3 MB",
      downloadUrl: "/downloads/auto-helper.zip"
    }],
    requirements: {
      minVersion: "1.0.0",
      dependencies: [],
      conflicts: []
    },
    downloads: 12300,
    views: 22100,
    rating: 4.6,
    ratingCount: 73,
    isActive: true,
    isFeatured: false,
    isPopular: true,
    publishedAt: new Date('2024-12-08'),
    keywords: ["automation", "helper", "script", "assistant"]
  },
  {
    name: "Alpine Valley Map",
    description: "Beautiful mountain farming terrain with challenges. Experience farming in a stunning alpine environment with unique terrain features, challenging slopes, and breathtaking scenery. Features custom field layouts and realistic topography.",
    shortDescription: "Beautiful mountain farming terrain with challenges",
    type: "paid",
    price: 7.99,
    version: "1.0.0",
    game: "FS25",
    category: "Maps",
    tags: ["map", "alpine", "mountain", "terrain"],
    thumbnail: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop"
    ],
    files: [{
      name: "AlpineValley.zip",
      size: "89.4 MB",
      downloadUrl: "/downloads/alpine-valley.zip"
    }],
    requirements: {
      minVersion: "1.0.0",
      dependencies: [],
      conflicts: []
    },
    downloads: 6890,
    views: 13250,
    rating: 4.5,
    ratingCount: 34,
    isActive: true,
    isFeatured: false,
    isPopular: false,
    publishedAt: new Date('2024-12-05'),
    keywords: ["map", "alpine", "mountain", "beautiful"]
  },
  {
    name: "Premium Tractor Collection",
    description: "High-quality tractors with realistic sounds and physics. This premium collection features meticulously detailed tractors from major manufacturers with authentic engine sounds, realistic handling, and detailed interiors.",
    shortDescription: "High-quality tractors with realistic sounds and physics",
    type: "paid",
    price: 9.99,
    version: "2.2.0",
    game: "FS22",
    category: "Vehicles",
    tags: ["tractors", "premium", "realistic", "collection"],
    thumbnail: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
    screenshots: [
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&h=600&fit=crop"
    ],
    videoUrl: "https://www.youtube.com/watch?v=example3",
    files: [{
      name: "PremiumTractors.zip",
      size: "67.2 MB",
      downloadUrl: "/downloads/premium-tractors.zip"
    }],
    requirements: {
      minVersion: "1.0.0",
      dependencies: [],
      conflicts: []
    },
    downloads: 18750,
    views: 31400,
    rating: 4.8,
    ratingCount: 95,
    isActive: true,
    isFeatured: true,
    isPopular: true,
    publishedAt: new Date('2024-12-03'),
    keywords: ["tractor", "premium", "realistic", "vehicles"]
  }
];

const createSampleMods = async () => {
  try {
    await connectDB();
    console.log('📦 Connected to MongoDB');

    // Find admin user to use as author
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    console.log('👤 Using admin user as author:', adminUser.email);

    // Clear existing mods (optional)
    const existingCount = await Mod.countDocuments();
    console.log(`📊 Found ${existingCount} existing mods`);

    if (existingCount > 0) {
      console.log('🗑️ Clearing existing mods...');
      await Mod.deleteMany({});
    }

    // Create mods with admin as author
    const modsToCreate = sampleMods.map(mod => ({
      ...mod,
      author: {
        name: 'ModsBazaar',
        id: adminUser._id
      },
      slug: mod.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
    }));

    const createdMods = await Mod.insertMany(modsToCreate);
    
    console.log(`🎉 Successfully created ${createdMods.length} mods:`);
    createdMods.forEach(mod => {
      console.log(`  ✅ ${mod.name} (${mod.type}${mod.type === 'paid' ? ` - $${mod.price}` : mod.type === 'unlock' ? ` - ${mod.unlockCode}` : ''})`);
    });

    // Display summary
    const stats = await Mod.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalDownloads: { $sum: '$downloads' }
        }
      }
    ]);

    console.log('\n📈 Mod Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} mods, ${stat.totalDownloads} total downloads`);
    });

  } catch (error) {
    console.error('❌ Error creating mods:', error);
  } finally {
    process.exit(0);
  }
};

// Run the script
createSampleMods();
