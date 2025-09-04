import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// User interface
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastPasswordChange?: Date;
  
  // Gaming profile
  gamerTag?: string;
  favoriteGame: 'FS22' | 'FS25' | 'Both';
  joinedAt: Date;
  lastActive: Date;
  
  // Purchase & Download history
  purchasedMods: mongoose.Types.ObjectId[];
  unlockedMods: mongoose.Types.ObjectId[];
  favoriteMods: mongoose.Types.ObjectId[];
  downloadHistory: {
    modId: mongoose.Types.ObjectId;
    modName: string;
    downloadedAt: Date;
    downloadCount: number;
    type: 'free' | 'purchased' | 'unlock';
  }[];
  
  // User stats
  totalDownloads: number;
  totalSpent: number;
  
  // Settings
  preferences: {
    theme: 'dark' | 'light';
    notifications: {
      email: boolean;
      newMods: boolean;
      updates: boolean;
    };
    privacy: {
      showProfile: boolean;
      showDownloads: boolean;
    };
  };
  
  // Account status
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedUntil?: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateResetToken(): string;
  canDownloadMod(modType: string): boolean;
}

// User schema
const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  
  avatar: {
    type: String,
    default: null
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastPasswordChange: {
    type: Date,
    default: null
  },
  
  // Gaming profile
  gamerTag: {
    type: String,
    trim: true,
    maxlength: [30, 'Gamer tag cannot exceed 30 characters']
  },
  
  favoriteGame: {
    type: String,
    enum: ['FS22', 'FS25', 'Both'],
    default: 'Both'
  },
  
  joinedAt: {
    type: Date,
    default: Date.now
  },
  
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // References to mods
  purchasedMods: [{
    type: Schema.Types.ObjectId,
    ref: 'Mod'
  }],
  
  unlockedMods: [{
    type: Schema.Types.ObjectId,
    ref: 'Mod'
  }],
  
  favoriteMods: [{
    type: Schema.Types.ObjectId,
    ref: 'Mod'
  }],
  
  downloadHistory: [{
    modId: {
      type: Schema.Types.ObjectId,
      ref: 'Mod',
      required: true
    },
    modName: {
      type: String,
      required: true
    },
    downloadedAt: {
      type: Date,
      default: Date.now
    },
    downloadCount: {
      type: Number,
      default: 1
    },
    type: {
      type: String,
      enum: ['free', 'purchased', 'unlock'],
      required: true
    }
  }],
  
  // User statistics
  totalDownloads: {
    type: Number,
    default: 0
  },
  
  totalSpent: {
    type: Number,
    default: 0
  },
  
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      newMods: {
        type: Boolean,
        default: true
      },
      updates: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      showProfile: {
        type: Boolean,
        default: true
      },
      showDownloads: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isBanned: {
    type: Boolean,
    default: false
  },
  
  banReason: String,
  bannedUntil: Date
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance (email and username already have unique indexes)
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'downloadHistory.modId': 1 });

// Virtual for full name or display name
userSchema.virtual('displayName').get(function() {
  return this.gamerTag || this.username;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Update lastActive on login
userSchema.pre(/^find/, function(next) {
  // Only for active users
  (this as any).find({ isActive: { $ne: false } });
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Instance method to generate reset token
userSchema.methods.generateResetToken = function(): string {
  const token = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  
  this.resetPasswordToken = token;
  this.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return token;
};

// Instance method to check if user can download mod
userSchema.methods.canDownloadMod = function(modType: string): boolean {
  if (this.isBanned) return false;
  if (!this.isActive) return false;
  if (!this.isVerified) return false;
  
  return true;
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true, isBanned: false });
};

// Static method to get user stats
userSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        },
        verifiedUsers: {
          $sum: {
            $cond: [{ $eq: ['$isVerified', true] }, 1, 0]
          }
        },
        bannedUsers: {
          $sum: {
            $cond: [{ $eq: ['$isBanned', true] }, 1, 0]
          }
        },
        totalDownloads: { $sum: '$totalDownloads' },
        totalSpent: { $sum: '$totalSpent' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    verifiedUsers: 0,
    bannedUsers: 0,
    totalDownloads: 0,
    totalSpent: 0
  };
};

export const User = mongoose.model<IUser>('User', userSchema);
