import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Mod } from '../models/Mod';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { optionalAuthMiddleware, authMiddleware, verifiedMiddleware } from '../middleware/auth';

const router = express.Router();

// Get categories with mod counts
router.get('/categories', catchAsync(async (req: Request, res: Response): Promise<any> => {
  try {
    const categories = await Mod.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          totalDownloads: { $sum: '$downloads' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get popular mods for each category
    const categoriesWithMods = await Promise.all(categories.map(async (cat) => {
      const popularMods = await Mod.find({ 
        category: cat._id, 
        isActive: true 
      })
        .select('name downloads rating')
        .sort({ downloads: -1, rating: -1 })
        .limit(4);

      return {
        name: cat._id,
        count: cat.count,
        avgRating: Math.round(cat.avgRating * 10) / 10,
        totalDownloads: cat.totalDownloads,
        popularMods: popularMods.map(mod => mod.name)
      };
    }));

    res.status(200).json({
      status: 'success',
      data: {
        categories: categoriesWithMods
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch categories'
    });
  }
}));

// Get all mods with filtering, sorting, and pagination
router.get('/', optionalAuthMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('type').optional().isIn(['free', 'paid', 'unlock']).withMessage('Invalid mod type'),
  query('game').optional().isIn(['FS22', 'FS25', 'Both']).withMessage('Invalid game'),
  query('category').optional().isString(),
  query('sort').optional().isIn(['newest', 'oldest', 'popular', 'rating', 'downloads']).withMessage('Invalid sort option')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = { isActive: true };
  
  if (req.query.type) filter.type = req.query.type;
  if (req.query.game && req.query.game !== 'Both') filter.game = { $in: [req.query.game, 'Both'] };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    filter.$text = { $search: req.query.search as string };
  }

  // Build sort query
  let sort: any = { publishedAt: -1 }; // Default: newest first
  
  switch (req.query.sort) {
    case 'oldest':
      sort = { publishedAt: 1 };
      break;
    case 'popular':
      sort = { downloads: -1, rating: -1 };
      break;
    case 'rating':
      sort = { rating: -1, ratingCount: -1 };
      break;
    case 'downloads':
      sort = { downloads: -1 };
      break;
  }

  // Execute query
  const [mods, total] = await Promise.all([
    Mod.find(filter)
      .select('name slug thumbnail type price shortDescription downloads rating ratingCount game category tags publishedAt isFeatured author')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('author.id', 'username'),
    Mod.countDocuments(filter)
  ]);

  const result = {
    mods,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMods: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };

  res.json({
    status: 'success',
    cached: false,
    data: result
  });
}));

// Get featured mods
router.get('/featured', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const mods = await Mod.find({ isActive: true, isFeatured: true })
    .select('name slug thumbnail type price shortDescription downloads rating game category author publishedAt')
    .sort({ publishedAt: -1 })
    .limit(6)
    .populate('author.id', 'username');

  res.json({
    status: 'success',
    cached: false,
    data: { mods }
  });
}));

// Get popular mods
router.get('/popular', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Use the hybrid smart popular system
  const mods = await Mod.find({ 
    isActive: true,
    $or: [
      { isPopular: true },  // Manually marked as popular
      { downloads: { $gte: 1000 }, rating: { $gte: 4.0 } }  // Auto-popular threshold
    ]
  })
    .select('name slug thumbnail type price shortDescription downloads rating game category isPopular author')
    .sort({ isPopular: -1, downloads: -1, rating: -1 })  // Manual popular first
    .limit(8)
    .populate('author.id', 'username');

  res.json({
    status: 'success',
    cached: false,
    data: { mods }
  });
}));

// Get recent mods
router.get('/recent', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const mods = await Mod.find({ isActive: true })
    .select('name slug thumbnail type price shortDescription downloads rating game category publishedAt author')
    .sort({ publishedAt: -1 })
    .limit(8)
    .populate('author.id', 'username');

  res.json({
    status: 'success',
    cached: false,
    data: { mods }
  });
}));

// Get platform stats for about page
router.get('/stats', catchAsync(async (req: Request, res: Response): Promise<any> => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments({ isActive: true });
    
    // Get total mods count
    const totalMods = await Mod.countDocuments({ isActive: true });
    
    // Get total downloads
    const downloadStats = await Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
    ]);
    
    // Get average rating
    const ratingStats = await Mod.aggregate([
      { $match: { isActive: true, rating: { $gt: 0 } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    // Get total reviews count
    const totalReviews = await Review.countDocuments();
    
    // Get featured mods count
    const featuredMods = await Mod.countDocuments({ isActive: true, isFeatured: true });
    
    // Get popular mods count (using our hybrid logic)
    const popularMods = await Mod.countDocuments({
      isActive: true,
      $or: [
        { isPopular: true },
        { downloads: { $gte: 1000 }, rating: { $gte: 4.0 } }
      ]
    });

    res.json({
      status: 'success',
      data: {
        totalUsers,
        totalMods,
        totalDownloads: downloadStats[0]?.totalDownloads || 0,
        averageRating: ratingStats[0]?.avgRating || 0,
        totalReviews,
        featuredMods,
        popularMods
      }
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch platform stats'
    });
  }
}));

// Get contributors/users with their stats for about page
router.get('/contributors', catchAsync(async (req: Request, res: Response): Promise<any> => {
  try {
    // Get users who have uploaded mods with their stats
    const contributors = await User.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'mods',
          localField: '_id',
          foreignField: 'author.id',
          as: 'mods'
        }
      },
      {
        $addFields: {
          modsCount: { $size: '$mods' },
          totalDownloads: { $sum: '$mods.downloads' },
          averageRating: { $avg: '$mods.rating' }
        }
      },
      {
        $match: {
          $or: [
            { modsCount: { $gt: 0 } }, // Users with mods
            { role: { $in: ['admin', 'moderator'] } } // Admin/moderator users
          ]
        }
      },
      {
        $project: {
          username: 1,
          email: 1,
          role: 1,
          avatar: 1,
          bio: 1,
          joinedAt: '$createdAt',
          modsCount: 1,
          totalDownloads: 1,
          averageRating: 1,
          isActive: 1
        }
      },
      {
        $sort: { 
          role: 1, // Admins first
          totalDownloads: -1, // Then by downloads
          modsCount: -1 // Then by mod count
        }
      }
    ]);

    // Separate users by role
    const owner = contributors.find(user => user.username.toLowerCase() === 'sekhon');
    const admins = contributors.filter(user => user.role === 'admin' && user.username.toLowerCase() !== 'sekhon');
    const moderators = contributors.filter(user => user.role === 'moderator');
    const regularContributors = contributors.filter(user => 
      user.role === 'user' && user.modsCount > 0
    );

    res.json({
      status: 'success',
      data: {
        owner: owner || null,
        admins,
        moderators,
        contributors: regularContributors,
        totalContributors: contributors.length
      }
    });
  } catch (error) {
    console.error('Error fetching contributors:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch contributors'
    });
  }
}));

// Get single mod by slug
router.get('/:slug', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;

  const mod = await Mod.findOne({ slug, isActive: true })
    .populate('author.id', 'username avatar gamerTag')
    .populate('reviews.userId', 'username avatar');

  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Increment view count
  mod.views += 1;
  await mod.save();

  // Check if user can download (if logged in)
  let canDownload = false;
  if (req.user) {
    canDownload = await mod.canUserDownload(req.user._id);
  }

  // Ensure author name is available
  const populatedAuthor = mod.author.id as any; // Handle populated author
  const modData = {
    ...mod.toObject(),
    canDownload,
    author: {
      name: mod.author.name || populatedAuthor?.username || 'Unknown Author',
      id: mod.author.id
    }
  };

  res.json({
    status: 'success',
    cached: false,
    data: { mod: modData }
  });
}));

// Download mod (track download count)
router.post('/:slug/download', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;

  const mod = await Mod.findOne({ slug, isActive: true });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check if user can download
  let canDownload = true;
  if (req.user && mod.type !== 'free') {
    canDownload = await mod.canUserDownload(req.user._id);
  }

  if (!canDownload && mod.type !== 'free') {
    return res.status(403).json({
      status: 'error',
      message: 'You need to purchase or unlock this mod before downloading',
      code: 'DOWNLOAD_NOT_ALLOWED'
    });
  }

  // Track the download
  await mod.trackDownload(req.user?._id);

  res.json({
    status: 'success',
    message: 'Download tracked successfully',
    data: {
      downloadUrl: mod.files[0]?.downloadUrl || '#',
      downloads: mod.downloads
    }
  });
}));

// Get mod by ObjectId (for internal use)
router.get('/id/:id', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid mod ID format',
      code: 'INVALID_ID'
    });
  }

  const mod = await Mod.findById(id)
    .populate('author.id', 'username avatar')
    .populate('reviews.userId', 'username avatar');

  if (!mod || !mod.isActive) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Increment view count
  mod.views += 1;
  await mod.save();

  // Check if user can download (if logged in)
  let canDownload = false;
  if (req.user) {
    canDownload = await mod.canUserDownload(req.user._id);
  }

  const modData = {
    ...mod.toObject(),
    canDownload
  };

  res.json({
    status: 'success',
    cached: false,
    data: { mod: modData }
  });
}));

// Add mod to favorites
router.post('/:slug/favorite', authMiddleware, verifiedMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;

  const mod = await Mod.findOne({ slug, isActive: true });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: 'User not found'
    });
  }

  const modId = (mod._id as any).toString();

  const isFavorited = user.favoriteMods.some(id => id.toString() === modId);

  if (isFavorited) {
    // Remove from favorites
    user.favoriteMods = user.favoriteMods.filter(id => id.toString() !== modId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Mod removed from favorites',
      data: { isFavorited: false }
    });
  } else {
    // Add to favorites
    user.favoriteMods.push(mod._id as any);
    await user.save();

    res.json({
      status: 'success',
      message: 'Mod added to favorites',
      data: { isFavorited: true }
    });
  }
}));

// Check if mod is favorited
router.get('/:slug/favorite', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;

  const mod = await Mod.findOne({ slug, isActive: true });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: 'User not found'
    });
  }

  const modId = (mod._id as any).toString();
  const isFavorited = user.favoriteMods.some(id => id.toString() === modId);

  res.json({
    status: 'success',
    data: { isFavorited }
  });
}));

// Add review to mod
router.post('/:slug/review', authMiddleware, verifiedMiddleware, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { slug } = req.params;
  const { rating, comment } = req.body;

  const mod = await Mod.findOne({ slug, isActive: true });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check if user has downloaded this mod (for paid/unlock mods)
  if (mod.type !== 'free') {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    const canDownload = await mod.canUserDownload(req.user._id);
    if (!canDownload) {
      return res.status(403).json({
        status: 'error',
        message: 'You must purchase/unlock this mod before reviewing',
        code: 'REVIEW_NOT_ALLOWED'
      });
    }
  }

  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  await mod.addReview(req.user._id, rating, comment);

  res.json({
    status: 'success',
    message: 'Review added successfully'
  });
}));

// Search mods
router.get('/search/:query', optionalAuthMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  try {
    const { query: searchQuery } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const [mods, total] = await Promise.all([
    Mod.find({
      $text: { $search: searchQuery },
      isActive: true
    })
    .select('name slug thumbnail type price shortDescription downloads rating game category')
    .sort({ score: { $meta: 'textScore' }, downloads: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author.id', 'username'),
    
    Mod.countDocuments({
      $text: { $search: searchQuery },
      isActive: true
    })
  ]);

  const result = {
    mods,
    query: searchQuery,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };

  res.json({
    status: 'success',
    cached: false,
    data: result
  });
  } catch (error) {
    console.error('Error searching mods:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}));

// REVIEW ROUTES
// Get all reviews for a mod
router.get('/:slug/reviews', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;
  const userId = (req as any).user?._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Get reviews
  const reviews = await Review.getModReviews(String(mod._id), userId);

  res.json({
    status: 'success',
    data: {
      reviews,
      total: reviews.length
    }
  });
}));

// Get user's review for a specific mod
router.get('/:slug/reviews/my-review', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug } = req.params;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Get user's review
  const review = await Review.getUserReviewForMod(userId, String(mod._id));

  res.json({
    status: 'success',
    data: { review: review || null }
  });
}));

// Submit a review
router.post('/:slug/reviews', authMiddleware, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { slug } = req.params;
  const { rating, comment } = req.body;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check if user already reviewed this mod
  const existingReview = await Review.getUserReviewForMod(userId, String(mod._id));
  if (existingReview) {
    return res.status(400).json({
      status: 'error',
      message: 'You have already reviewed this mod',
      code: 'REVIEW_EXISTS'
    });
  }

  // Create new review
  const review = new Review({
    user: userId,
    mod: mod._id,
    rating,
    comment: comment || undefined
  });

  await review.save();

  // Get updated mod stats
  const stats = await Review.calculateModRating(String(mod._id));

  res.status(201).json({
    status: 'success',
    message: 'Review submitted successfully',
    data: {
      review,
      stats
    }
  });
}));

// Update a review
router.patch('/:slug/reviews/:reviewId', authMiddleware, [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { slug, reviewId } = req.params;
  const { rating, comment } = req.body;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find and update review
  const review = await Review.findOne({
    _id: reviewId,
    user: userId,
    mod: mod._id
  });

  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found or you do not have permission to edit it',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Update fields
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  review.updatedAt = new Date();

  await review.save();

  // Get updated mod stats
  const stats = await Review.calculateModRating(String(mod._id));

  res.json({
    status: 'success',
    message: 'Review updated successfully',
    data: {
      review,
      stats
    }
  });
}));

// Delete a review
router.delete('/:slug/reviews/:reviewId', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug, reviewId } = req.params;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find and delete review
  const review = await Review.findOneAndDelete({
    _id: reviewId,
    user: userId,
    mod: mod._id
  });

  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found or you do not have permission to delete it',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Get updated mod stats
  const stats = await Review.calculateModRating(String(mod._id));

  res.json({
    status: 'success',
    message: 'Review deleted successfully',
    data: { stats }
  });
}));

// Vote on a review
router.post('/:slug/reviews/:reviewId/vote', authMiddleware, [
  body('type').isIn(['upvote', 'downvote']).withMessage('Vote type must be upvote or downvote')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { slug, reviewId } = req.params;
  const { type } = req.body;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find review
  const review = await Review.findOne({ _id: reviewId, mod: mod._id });
  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Can't vote on own review
  if (review.user.toString() === userId.toString()) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot vote on your own review',
      code: 'CANNOT_VOTE_OWN_REVIEW'
    });
  }

  // Add vote
  await review.addVote(userId, type);

  res.json({
    status: 'success',
    message: `${type === 'upvote' ? 'Upvote' : 'Downvote'} added successfully`,
    data: {
      upvotes: review.upvotes,
      downvotes: review.downvotes,
      userVote: await review.getUserVote(userId)
    }
  });
}));

// Remove vote from a review
router.delete('/:slug/reviews/:reviewId/vote', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { slug, reviewId } = req.params;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find review
  const review = await Review.findOne({ _id: reviewId, mod: mod._id });
  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Remove vote
  await review.removeVote(userId);

  res.json({
    status: 'success',
    message: 'Vote removed successfully',
    data: {
      upvotes: review.upvotes,
      downvotes: review.downvotes,
      userVote: null
    }
  });
}));

// Update/Edit mod (owner or admin only)
router.patch('/:id', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const modId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  const mod = await Mod.findById(modId);
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check permissions: owner or admin
  const isOwner = mod.author.toString() === userId.toString();
  if (!isOwner && userRole !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'You can only edit your own mods',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  // Fields that can be updated
  const allowedUpdates = [
    'name', 'description', 'shortDescription', 'version', 'game', 'category', 
    'tags', 'thumbnail', 'screenshots', 'videoUrl', 'files', 'type', 'price', 
    'unlockCode', 'requirements', 'dependencies', 'conflicts'
  ];

  const updates: any = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Regenerate slug if name is being updated
  if (updates.name && updates.name !== mod.name) {
    const baseSlug = updates.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Check if slug exists and make it unique
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await Mod.findOne({ slug: uniqueSlug, _id: { $ne: modId } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    updates.slug = uniqueSlug;
  }

  // Update the mod
  const updatedMod = await Mod.findByIdAndUpdate(modId, updates, { 
    new: true, 
    runValidators: true 
  }).populate('author', 'username');

  res.json({
    status: 'success',
    message: 'Mod updated successfully',
    data: { mod: updatedMod }
  });
}));

// Delete mod (owner or admin only)
router.delete('/:id', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const modId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  const mod = await Mod.findById(modId);
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check permissions: owner or admin
  if (mod.author.id.toString() !== userId.toString() && userRole !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'You can only delete your own mods',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  // Delete the mod
  await Mod.findByIdAndDelete(modId);

  res.json({
    status: 'success',
    message: 'Mod deleted successfully'
  });
}));

// Unpublish mod (admin or owner)
router.patch('/:id/unpublish', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const modId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  const mod = await Mod.findById(modId);
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check if user is admin or mod owner
  const isOwner = mod.author.toString() === userId.toString();
  if (userRole !== 'admin' && !isOwner) {
    return res.status(403).json({
      status: 'error',
      message: 'You can only unpublish your own mods',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  // Unpublish the mod
  mod.isActive = false;
  await mod.save();

  res.json({
    status: 'success',
    message: 'Mod unpublished successfully',
    data: { mod }
  });
}));

// Republish mod (admin or owner)
router.patch('/:id/republish', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const modId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  const mod = await Mod.findById(modId);
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Check if user is admin or mod owner
  const isOwner = mod.author.toString() === userId.toString();
  if (userRole !== 'admin' && !isOwner) {
    return res.status(403).json({
      status: 'error',
      message: 'You can only republish your own mods',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  // Republish the mod
  mod.isActive = true;
  await mod.save();

  res.json({
    status: 'success',
    message: 'Mod republished successfully',
    data: { mod }
  });
}));

export default router;
