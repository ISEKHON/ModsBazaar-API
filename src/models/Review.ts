import mongoose, { Document, Schema, Model } from 'mongoose';

// Review interface
export interface IReview extends Document {
  user: mongoose.Types.ObjectId;
  mod: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  upvotes: number;
  downvotes: number;
  votes: Array<{
    user: mongoose.Types.ObjectId;
    type: 'up' | 'down';
  }>;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getUserVote(userId: string): 'up' | 'down' | null;
  addVote(userId: string, voteType: 'up' | 'down'): void;
  removeVote(userId: string): void;
}

// Static methods interface
export interface IReviewModel extends Model<IReview> {
  getModReviews(modId: string, userId?: string): Promise<any[]>;
  getUserReviewForMod(userId: string, modId: string): Promise<IReview | null>;
  calculateModRating(modId: string): Promise<{ averageRating: number; totalReviews: number }>;
}

// Review schema
const reviewSchema = new Schema<IReview, IReviewModel>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  
  mod: {
    type: Schema.Types.ObjectId,
    ref: 'Mod',
    required: [true, 'Mod is required']
  },
  
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  
  comment: {
    type: String,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
    trim: true
  },
  
  upvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  downvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  votes: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['up', 'down'],
      required: true
    }
  }]
}, {
  timestamps: true
});

// Indexes
reviewSchema.index({ mod: 1, user: 1 }, { unique: true }); // One review per user per mod
reviewSchema.index({ mod: 1, createdAt: -1 }); // For fetching mod reviews
reviewSchema.index({ user: 1 }); // For user reviews
reviewSchema.index({ rating: 1 }); // For rating aggregation

// Instance methods
reviewSchema.methods.getUserVote = function(userId: string): 'up' | 'down' | null {
  const vote = this.votes.find((v: any) => v.user.toString() === userId);
  return vote ? vote.type : null;
};

reviewSchema.methods.addVote = function(userId: string, voteType: 'up' | 'down'): void {
  // Remove existing vote if any
  this.removeVote(userId);
  
  // Add new vote
  this.votes.push({ user: new mongoose.Types.ObjectId(userId), type: voteType });
  
  // Update counters
  if (voteType === 'up') {
    this.upvotes += 1;
  } else {
    this.downvotes += 1;
  }
};

reviewSchema.methods.removeVote = function(userId: string): void {
  const existingVoteIndex = this.votes.findIndex((v: any) => v.user.toString() === userId);
  
  if (existingVoteIndex !== -1) {
    const existingVote = this.votes[existingVoteIndex];
    
    // Update counters
    if (existingVote.type === 'up') {
      this.upvotes = Math.max(0, this.upvotes - 1);
    } else {
      this.downvotes = Math.max(0, this.downvotes - 1);
    }
    
    // Remove vote
    this.votes.splice(existingVoteIndex, 1);
  }
};

// Static methods
reviewSchema.statics.getModReviews = async function(modId: string, userId?: string) {
  const reviews = await this.aggregate([
    { $match: { mod: new mongoose.Types.ObjectId(modId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
        pipeline: [
          {
            $project: {
              username: 1,
              gamerTag: 1
            }
          }
        ]
      }
    },
    {
      $unwind: '$user'
    },
    {
      $addFields: {
        userVote: userId ? {
          $let: {
            vars: {
              userVote: {
                $filter: {
                  input: '$votes',
                  cond: { $eq: ['$$this.user', new mongoose.Types.ObjectId(userId)] }
                }
              }
            },
            in: {
              $cond: {
                if: { $gt: [{ $size: '$$userVote' }, 0] },
                then: { $arrayElemAt: ['$$userVote.type', 0] },
                else: null
              }
            }
          }
        } : null
      }
    },
    {
      $project: {
        rating: 1,
        comment: 1,
        upvotes: 1,
        downvotes: 1,
        userVote: 1,
        createdAt: 1,
        updatedAt: 1,
        user: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
  
  return reviews;
};

reviewSchema.statics.getUserReviewForMod = function(userId: string, modId: string) {
  return this.findOne({
    user: new mongoose.Types.ObjectId(userId),
    mod: new mongoose.Types.ObjectId(modId)
  });
};

reviewSchema.statics.calculateModRating = async function(modId: string) {
  const result = await this.aggregate([
    { $match: { mod: new mongoose.Types.ObjectId(modId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { averageRating: 0, totalReviews: 0 };
  }
  
  return {
    averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
    totalReviews: result[0].totalReviews
  };
};

// Pre-save middleware to update mod rating
reviewSchema.post('save', async function() {
  const Mod = mongoose.model('Mod');
  const stats = await (this.constructor as IReviewModel).calculateModRating(this.mod.toString());
  
  await Mod.findByIdAndUpdate(this.mod, {
    rating: stats.averageRating,
    ratingCount: stats.totalReviews
  });
});

// Pre-remove middleware to update mod rating
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const Mod = mongoose.model('Mod');
    const stats = await (doc.constructor as IReviewModel).calculateModRating(doc.mod.toString());
    
    await Mod.findByIdAndUpdate(doc.mod, {
      rating: stats.averageRating,
      ratingCount: stats.totalReviews
    });
  }
});

export const Review = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);
