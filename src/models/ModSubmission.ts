import mongoose, { Document, Schema, Model } from 'mongoose';

// Mod Submission interface
export interface IModSubmission extends Document {
  submittedBy: mongoose.Types.ObjectId;
  name: string;
  description: string;
  shortDescription: string;
  type: 'free' | 'paid' | 'unlock';
  price?: number;
  unlockCode?: string;
  version: string;
  game: 'FS22' | 'FS25' | 'Both';
  category: string;
  tags: string[];
  
  // Media and files
  thumbnail: string; // Required - single thumbnail image URL
  screenshots: string[]; // Optional - up to 5 additional screenshots
  videoUrl?: string; // Optional - YouTube video URL
  downloadUrl: string; // Required - direct download link
  fileSize?: string; // Optional - file size info
  
  // Submission status
  status: 'pending' | 'approved' | 'rejected' | 'published';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  rejectionReason?: string;
  
  // Requirements and compatibility
  requirements: string[];
  dependencies: string[];
  conflicts: string[];
  
  // Metadata
  submittedAt: Date;
  updatedAt: Date;
  
  // If approved, the actual published mod ID
  publishedModId?: mongoose.Types.ObjectId;
  
  // Instance methods
  canBeEditedBy(userId: string): boolean;
  canBeReviewedBy(userRole: string): boolean;
}

// Static methods interface
export interface IModSubmissionModel extends Model<IModSubmission> {
  getSubmissionsByUser(userId: string): Promise<IModSubmission[]>;
  getPendingSubmissions(): Promise<IModSubmission[]>;
}

// Mod Submission schema
const modSubmissionSchema = new Schema<IModSubmission, IModSubmissionModel>({
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Submitter is required']
  },
  
  name: {
    type: String,
    required: [true, 'Mod name is required'],
    trim: true,
    minlength: [3, 'Mod name must be at least 3 characters'],
    maxlength: [100, 'Mod name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  
  type: {
    type: String,
    enum: ['free', 'paid', 'unlock'],
    required: [true, 'Mod type is required']
  },
  
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    max: [999.99, 'Price cannot exceed $999.99'],
    validate: {
      validator: function(this: IModSubmission, value: number) {
        return this.type !== 'paid' || (value !== undefined && value > 0);
      },
      message: 'Price is required for paid mods'
    }
  },
  
  unlockCode: {
    type: String,
    validate: {
      validator: function(this: IModSubmission, value: string) {
        return this.type !== 'unlock' || (value && value.length >= 6);
      },
      message: 'Unlock code is required for unlock mods and must be at least 6 characters'
    }
  },
  
  version: {
    type: String,
    required: [true, 'Version is required'],
    match: [/^\d+\.\d+\.\d+$/, 'Version must be in format x.y.z (e.g., 1.0.0)']
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
      'Tractors', 'Harvesters', 'Implements', 'Trailers', 'Trucks',
      'Maps', 'Buildings', 'Animals', 'Textures', 'Scripts', 'Other'
    ]
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Media
  thumbnail: {
    type: String,
    required: [true, 'Thumbnail image is required'],
    validate: {
      validator: function(value: string) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(value);
      },
      message: 'Thumbnail must be a valid image URL (jpg, jpeg, png, webp)'
    }
  },
  
  screenshots: [{
    type: String,
    validate: {
      validator: function(value: string) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(value);
      },
      message: 'Screenshots must be valid image URLs (jpg, jpeg, png, webp)'
    }
  }],
  
  videoUrl: {
    type: String,
    validate: {
      validator: function(value: string) {
        if (!value) return true; // Optional field
        return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/).+/.test(value);
      },
      message: 'Video URL must be a valid YouTube URL'
    }
  },
  
  downloadUrl: {
    type: String,
    required: [true, 'Download URL is required'],
    validate: {
      validator: function(value: string) {
        return /^https?:\/\/.+/.test(value);
      },
      message: 'Download URL must be a valid URL'
    }
  },
  
  fileSize: {
    type: String,
    validate: {
      validator: function(value: string) {
        if (!value) return true; // Optional field
        return /^\d+(\.\d+)?\s*(B|KB|MB|GB)$/i.test(value);
      },
      message: 'File size must be in format like "45.2 MB"'
    }
  },
  
  // Status and review
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'published'],
    default: 'pending'
  },
  
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewedAt: Date,
  
  reviewNotes: {
    type: String,
    maxlength: [1000, 'Review notes cannot exceed 1000 characters']
  },
  
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // Requirements
  requirements: [{
    type: String,
    trim: true
  }],
  
  dependencies: [{
    type: String,
    trim: true
  }],
  
  conflicts: [{
    type: String,
    trim: true
  }],
  
  // Metadata
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  publishedModId: {
    type: Schema.Types.ObjectId,
    ref: 'Mod'
  }
}, {
  timestamps: { createdAt: 'submittedAt', updatedAt: 'updatedAt' }
});

// Indexes
modSubmissionSchema.index({ submittedBy: 1, status: 1 });
modSubmissionSchema.index({ status: 1, submittedAt: -1 });
modSubmissionSchema.index({ reviewedBy: 1 });

// Pre-save middleware
modSubmissionSchema.pre('save', function(next) {
  // Validate screenshots array length
  if (this.screenshots && this.screenshots.length > 5) {
    return next(new Error('Cannot have more than 5 screenshots'));
  }
  
  // Ensure at least one screenshot (thumbnail is required separately)
  if (!this.screenshots || this.screenshots.length === 0) {
    this.screenshots = [];
  }
  
  next();
});

// Instance methods
modSubmissionSchema.methods.canBeEditedBy = function(userId: string): boolean {
  return this.submittedBy.toString() === userId && this.status === 'pending';
};

modSubmissionSchema.methods.canBeReviewedBy = function(userRole: string): boolean {
  return userRole === 'admin' && this.status === 'pending';
};

// Static methods
modSubmissionSchema.statics.getSubmissionsByUser = function(userId: string) {
  try {
    return this.find({ submittedBy: userId })
      .sort({ submittedAt: -1 })
      .lean(); // Return plain objects for better performance
  } catch (error) {
    console.error('Error in getSubmissionsByUser:', error);
    return [];
  }
};

modSubmissionSchema.statics.getPendingSubmissions = function() {
  return this.find({ status: 'pending' })
    .populate('submittedBy', 'username email gamerTag')
    .sort({ submittedAt: 1 }); // Oldest first for review queue
};

export const ModSubmission = mongoose.model<IModSubmission, IModSubmissionModel>('ModSubmission', modSubmissionSchema);
