import mongoose, { Document, Schema } from 'mongoose';

// Mod interface with three-tier system
export interface IMod extends Document {
  // Basic mod information
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  
  // Three-tier system
  type: 'free' | 'paid' | 'unlock';
  price?: number; // For paid mods
  unlockCode?: string; // For unlock mods
  
  // Mod details
  version: string;
  game: 'FS22' | 'FS25' | 'Both';
  category: string;
  tags: string[];
  
  // Media
  thumbnail: string;
  screenshots: string[];
  videoUrl?: string;
  
  // Files
  files: {
    name: string;
    size: string;
    downloadUrl: string;
    uploadedAt: Date;
  }[];
  
  // Author info (always ModsBazaar since you're the only uploader)
  author: {
    name: string;
    id: mongoose.Types.ObjectId;
  };
  
  // Stats
  downloads: number;
  views: number;
  rating: number;
  ratingCount: number;
  
  // Reviews and ratings
  reviews: {
    userId: mongoose.Types.ObjectId;
    username: string;
    rating: number;
    comment: string;
    createdAt: Date;
    isVerified: boolean;
  }[];
  
  // Requirements and compatibility
  requirements: {
    minVersion: string;
    maxVersion: string;
    dependencies: string[];
    conflicts: string[];
  };
  
  // Status
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  
  // Analytics
  downloadHistory: {
    userId?: mongoose.Types.ObjectId;
    ip: string;
    userAgent: string;
    downloadedAt: Date;
  }[];
  
  // Methods
  incrementDownloads(): Promise<void>;
  addReview(userId: string, rating: number, comment: string): Promise<void>;
  calculateAverageRating(): Promise<void>;
  canUserDownload(userId: string): Promise<boolean>;
  trackDownload(userId?: string): Promise<void>;
}

// Mod schema
const modSchema = new Schema<IMod>({
  name: {
    type: String,
    required: [true, 'Mod name is required'],
    trim: true,
    maxlength: [100, 'Mod name cannot exceed 100 characters']
  },
  
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  
  // Three-tier system
  type: {
    type: String,
    enum: ['free', 'paid', 'unlock'],
    required: [true, 'Mod type is required']
  },
  
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(this: IMod, value: number) {
        return this.type !== 'paid' || (value && value > 0);
      },
      message: 'Price is required for paid mods'
    }
  },
  
  unlockCode: {
    type: String,
    validate: {
      validator: function(this: any, value: string) {
        if (this.type === 'unlock') {
          return value && value.length >= 6;
        }
        return true;
      },
      message: 'Unlock code is required for unlock mods and must be at least 6 characters'
    }
  },
  
  // Mod details
  version: {
    type: String,
    required: [true, 'Version is required'],
    match: [/^\d+\.\d+(\.\d+)?$/, 'Version must be in format X.Y or X.Y.Z']
  },
  
  game: {
    type: String,
    enum: ['FS22', 'FS25', 'Both'],
    required: [true, 'Game compatibility is required']
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Vehicles',
      'Tractors', 
      'Harvesters',
      'Tools',
      'Maps',
      'Textures',
      'Sounds',
      'Scripts',
      'Other'
    ]
  },
  
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Media
  thumbnail: {
    type: String,
    required: [true, 'Thumbnail is required']
  },
  
  screenshots: [{
    type: String
  }],
  
  videoUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Video URL must be a valid URL']
  },
  
  // Files
  files: [{
    name: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true
    },
    downloadUrl: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Author (always you as ModsBazaar)
  author: {
    name: {
      type: String,
      default: 'ModsBazaar'
    },
    id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  
  // Statistics
  downloads: {
    type: Number,
    default: 0,
    min: 0
  },
  
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  ratingCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Reviews
  reviews: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Requirements
  requirements: {
    minVersion: {
      type: String,
      match: [/^\d+\.\d+(\.\d+)?$/, 'Version must be in format X.Y or X.Y.Z']
    },
    maxVersion: {
      type: String,
      match: [/^\d+\.\d+(\.\d+)?$/, 'Version must be in format X.Y or X.Y.Z']
    },
    dependencies: [String],
    conflicts: [String]
  },
  
  // Status flags
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  isPopular: {
    type: Boolean,
    default: false
  },
  
  publishedAt: Date,
  
  // SEO
  metaTitle: {
    type: String,
    maxlength: [60, 'Meta title cannot exceed 60 characters']
  },
  
  metaDescription: {
    type: String,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  
  keywords: [{
    type: String,
    lowercase: true
  }],
  
  // Analytics
  downloadHistory: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    ip: String,
    userAgent: String,
    downloadedAt: {
      type: Date,
      default: Date.now
    }
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance (slug already has unique index)
modSchema.index({ type: 1 });
modSchema.index({ game: 1 });
modSchema.index({ category: 1 });
modSchema.index({ tags: 1 });
modSchema.index({ isActive: 1 });
modSchema.index({ isFeatured: 1 });
modSchema.index({ isPopular: 1 });
modSchema.index({ downloads: -1 });
modSchema.index({ rating: -1 });
modSchema.index({ createdAt: -1 });
modSchema.index({ publishedAt: -1 });

// Text search index
modSchema.index({
  name: 'text',
  description: 'text',
  shortDescription: 'text',
  tags: 'text',
  category: 'text'
});

// Compound indexes
modSchema.index({ type: 1, game: 1, isActive: 1 });
modSchema.index({ category: 1, isActive: 1, publishedAt: -1 });

// Virtual for average rating
modSchema.virtual('averageRating').get(function(this: IMod) {
  if (this.ratingCount === 0) return 0;
  return Math.round((this.rating / this.ratingCount) * 10) / 10;
});

// Virtual for download count display
modSchema.virtual('downloadDisplay').get(function(this: IMod) {
  if (this.downloads >= 1000000) {
    return `${(this.downloads / 1000000).toFixed(1)}M`;
  } else if (this.downloads >= 1000) {
    return `${(this.downloads / 1000).toFixed(1)}K`;
  }
  return this.downloads.toString();
});

// Pre-save middleware to generate slug
modSchema.pre('save', function(this: IMod, next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Instance method to increment downloads
modSchema.methods.incrementDownloads = async function(): Promise<void> {
  this.downloads += 1;
  await this.save();
};

// Instance method to add review
modSchema.methods.addReview = async function(this: IMod, userId: string, rating: number, comment: string): Promise<void> {
  // Check if user already reviewed
  const existingReview = this.reviews.find((r: any) => r.userId.toString() === userId);
  
  if (existingReview) {
    // Update existing review
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.createdAt = new Date();
  } else {
    // Add new review
    this.reviews.push({
      userId: new mongoose.Types.ObjectId(userId),
      username: '', // Will be populated
      rating,
      comment,
      createdAt: new Date(),
      isVerified: false
    });
  }
  
  await this.calculateAverageRating();
  await this.save();
};

// Instance method to calculate average rating
modSchema.methods.calculateAverageRating = async function(this: IMod): Promise<void> {
  if (this.reviews.length === 0) {
    this.rating = 0;
    this.ratingCount = 0;
    return;
  }
  
  const totalRating = this.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
  this.rating = totalRating / this.reviews.length;
  this.ratingCount = this.reviews.length;
};

// Instance method to check if user can download
modSchema.methods.canUserDownload = async function(userId: string): Promise<boolean> {
  if (this.type === 'free') return true;
  
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return false;
  
  if (this.type === 'paid') {
    return user.purchasedMods.includes(this._id);
  }
  
  if (this.type === 'unlock') {
    return user.unlockedMods.includes(this._id);
  }
  
  return false;
};

// Instance method to track download
modSchema.methods.trackDownload = async function(userId?: string): Promise<void> {
  this.downloads += 1;
  
  if (userId) {
    // Add to download history if user is logged in
    this.downloadHistory.push({
      userId: userId,
      downloadedAt: new Date()
    });
  }
  
  await this.save();
};

// Static method to find popular mods
modSchema.statics.findPopular = function(limit: number = 10) {
  // First try manual popular mods, then fall back to algorithm
  return this.find({ 
    isActive: true,
    $or: [
      { isPopular: true },  // Manually marked as popular
      { downloads: { $gte: 1000 }, rating: { $gte: 4.0 } }  // Auto-popular threshold
    ]
  })
  .sort({ isPopular: -1, downloads: -1, rating: -1 })  // Manual popular first
  .limit(limit);
};

// Static method to find featured mods
modSchema.statics.findFeatured = function() {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ publishedAt: -1 });
};

// Static method to find recent mods
modSchema.statics.findRecent = function(limit: number = 10) {
  return this.find({ isActive: true })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to get mod statistics
modSchema.statics.getModStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalMods: { $sum: 1 },
        activeMods: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        freeMods: {
          $sum: { $cond: [{ $eq: ['$type', 'free'] }, 1, 0] }
        },
        paidMods: {
          $sum: { $cond: [{ $eq: ['$type', 'paid'] }, 1, 0] }
        },
        unlockMods: {
          $sum: { $cond: [{ $eq: ['$type', 'unlock'] }, 1, 0] }
        },
        totalDownloads: { $sum: '$downloads' },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);
  
  return stats[0] || {
    totalMods: 0,
    activeMods: 0,
    freeMods: 0,
    paidMods: 0,
    unlockMods: 0,
    totalDownloads: 0,
    averageRating: 0
  };
};

export const Mod = mongoose.model<IMod>('Mod', modSchema);
