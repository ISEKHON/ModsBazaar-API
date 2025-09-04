import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { User } from '../models/User';
import { Mod } from '../models/Mod';
import { catchAsync, AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get user's favorite mods
router.get('/favorites', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('game').optional().isIn(['FS22', 'FS25']).withMessage('Game must be FS22 or FS25'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('sort').optional().isIn(['newest', 'oldest', 'name', 'downloads', 'rating']).withMessage('Invalid sort option')
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
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  
  const { game, category, sort = 'newest' } = req.query;

  // Build query
  const matchQuery: any = {
    _id: { $in: req.user.favoriteMods }
  };

  if (game) matchQuery.game = game;
  if (category) matchQuery.category = category;

  // Build sort query
  let sortQuery: any = { createdAt: -1 };
  switch (sort) {
    case 'oldest':
      sortQuery = { createdAt: 1 };
      break;
    case 'name':
      sortQuery = { name: 1 };
      break;
    case 'downloads':
      sortQuery = { downloads: -1 };
      break;
    case 'rating':
      sortQuery = { 'reviews.averageRating': -1 };
      break;
  }

  // Execute aggregation
  const result = await Mod.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'author',
        pipeline: [
          {
            $project: {
              name: 1,
              username: 1
            }
          }
        ]
      }
    },
    {
      $unwind: {
        path: '$author',
        preserveNullAndEmptyArrays: true
      }
    },
    { $sort: sortQuery },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        name: 1,
        description: 1,
        thumbnail: 1,
        type: 1,
        game: 1,
        category: 1,
        price: 1,
        downloads: 1,
        slug: 1,
        'reviews.averageRating': 1,
        'reviews.totalReviews': 1,
        author: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ]);

  // Get total count
  const totalCount = await Mod.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalCount / limit);

  const response = {
    data: {
      favorites: result,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };

  res.json({
    status: 'success',
    ...response
  });
}));

// Add mod to favorites
router.post('/favorites/:modId', [
  param('modId').isMongoId().withMessage('Invalid mod ID')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modId } = req.params;

  // Check if mod exists
  const mod = await Mod.findById(modId);
  if (!mod) {
    throw new AppError('Mod not found', 404, 'MOD_NOT_FOUND');
  }

  // Check if already in favorites
  if (req.user.favoriteMods.includes(new mongoose.Types.ObjectId(modId))) {
    throw new AppError('Mod already in favorites', 400, 'ALREADY_FAVORITED');
  }

  // Add to favorites
  await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { favoriteMods: modId } }
  );

  // Update mod's favorites count
  await Mod.findByIdAndUpdate(
    modId,
    { $inc: { favorites: 1 } }
  );

  res.json({
    status: 'success',
    message: 'Mod added to favorites! ❤️'
  });
}));

// Remove mod from favorites
router.delete('/favorites/:modId', [
  param('modId').isMongoId().withMessage('Invalid mod ID')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modId } = req.params;

  // Check if in favorites
  if (!req.user.favoriteMods.includes(new mongoose.Types.ObjectId(modId))) {
    throw new AppError('Mod not in favorites', 400, 'NOT_FAVORITED');
  }

  // Remove from favorites
  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { favoriteMods: modId } }
  );

  // Update mod's favorites count
  await Mod.findByIdAndUpdate(
    modId,
    { $inc: { favorites: -1 } }
  );

  res.json({
    status: 'success',
    message: 'Mod removed from favorites'
  });
}));

// Get user's download history
router.get('/downloads', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('game').optional().isIn(['FS22', 'FS25']).withMessage('Game must be FS22 or FS25'),
  query('type').optional().isIn(['free', 'paid', 'unlock']).withMessage('Type must be free, paid, or unlock')
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
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  
  const { game, type } = req.query;

  // Build match query for downloads
  const matchQuery: any = {};
  if (game) matchQuery['modDetails.game'] = game;
  if (type) matchQuery['modDetails.type'] = type;

  // Get downloads with mod details
  const downloads = await User.aggregate([
    { $match: { _id: req.user._id } },
    { $unwind: '$downloadHistory' },
    {
      $lookup: {
        from: 'mods',
        localField: 'downloadHistory.modId',
        foreignField: '_id',
        as: 'modDetails'
      }
    },
    { $unwind: '$modDetails' },
    { $match: matchQuery },
    { $sort: { 'downloadHistory.downloadedAt': -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        downloadedAt: '$downloadHistory.downloadedAt',
        modId: '$downloadHistory.modId',
        name: '$modDetails.name',
        thumbnail: '$modDetails.thumbnail',
        type: '$modDetails.type',
        game: '$modDetails.game',
        category: '$modDetails.category',
        price: '$modDetails.price',
        slug: '$modDetails.slug'
      }
    }
  ]);

  // Get total count
  const totalCountResult = await User.aggregate([
    { $match: { _id: req.user._id } },
    { $unwind: '$downloadHistory' },
    {
      $lookup: {
        from: 'mods',
        localField: 'downloadHistory.modId',
        foreignField: '_id',
        as: 'modDetails'
      }
    },
    { $unwind: '$modDetails' },
    { $match: matchQuery },
    { $count: 'total' }
  ]);

  const totalCount = totalCountResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const response = {
    data: {
      downloads,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };

  res.json({
    status: 'success',
    ...response
  });
}));

// Get user's purchased mods
router.get('/purchases', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('game').optional().isIn(['FS22', 'FS25']).withMessage('Game must be FS22 or FS25')
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
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  
  const { game } = req.query;

  // Build query
  const matchQuery: any = {
    _id: { $in: req.user.purchasedMods }
  };

  if (game) matchQuery.game = game;

  // Get purchased mods
  const purchasedMods = await Mod.find(matchQuery)
    .select('name description thumbnail type game category price slug reviews.averageRating reviews.totalReviews createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count
  const totalCount = await Mod.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalCount / limit);

  const response = {
    data: {
      purchases: purchasedMods,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };

  res.json({
    status: 'success',
    ...response
  });
}));

// Get user statistics
router.get('/stats', catchAsync(async (req: Request, res: Response): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  // Calculate stats
  const [
    totalDownloads,
    totalFavorites,
    totalPurchases,
    totalUnlocks,
    recentActivity
  ] = await Promise.all([
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $project: { downloadCount: { $size: '$downloadHistory' } } }
    ]),
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $project: { favoriteCount: { $size: '$favoriteMods' } } }
    ]),
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $project: { purchaseCount: { $size: '$purchasedMods' } } }
    ]),
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $project: { unlockCount: { $size: '$unlockedMods' } } }
    ]),
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $unwind: '$downloadHistory' },
      { $sort: { 'downloadHistory.downloadedAt': -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'mods',
          localField: 'downloadHistory.modId',
          foreignField: '_id',
          as: 'modDetails'
        }
      },
      { $unwind: '$modDetails' },
      {
        $project: {
          downloadedAt: '$downloadHistory.downloadedAt',
          modName: '$modDetails.name',
          modSlug: '$modDetails.slug',
          modThumbnail: '$modDetails.thumbnail'
        }
      }
    ])
  ]);

  const stats = {
    downloads: totalDownloads[0]?.downloadCount || 0,
    favorites: totalFavorites[0]?.favoriteCount || 0,
    purchases: totalPurchases[0]?.purchaseCount || 0,
    unlocks: totalUnlocks[0]?.unlockCount || 0,
    recentActivity: recentActivity || [],
    memberSince: req.user.joinedAt,
    lastActive: req.user.lastActive
  };

  res.json({
    status: 'success',
    data: { stats }
  });
}));

// Get user profile data
router.get('/profile', catchAsync(async (req: Request, res: Response): Promise<any> => {
  const user = await User.findById(req.user._id)
    .populate('favoriteMods', 'name thumbnail type price slug')
    .populate('purchasedMods', 'name thumbnail type price slug downloads')
    .populate('unlockedMods', 'name thumbnail type slug downloads');

  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found'
    });
  }

  res.json({
    status: 'success',
    data: {
      user: user.toObject()
    }
  });
}));

// Update user preferences
router.patch('/preferences', [
  body('theme').optional().isIn(['dark', 'light']).withMessage('Theme must be dark or light'),
  body('notifications.email').optional().isBoolean().withMessage('Email notification preference must be boolean'),
  body('notifications.newMods').optional().isBoolean().withMessage('New mods notification preference must be boolean'),
  body('notifications.updates').optional().isBoolean().withMessage('Updates notification preference must be boolean'),
  body('privacy.showProfile').optional().isBoolean().withMessage('Show profile preference must be boolean'),
  body('privacy.showDownloads').optional().isBoolean().withMessage('Show downloads preference must be boolean')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const updates: any = {};
  
  // Handle nested preference updates
  if (req.body.theme) {
    updates['preferences.theme'] = req.body.theme;
  }
  
  if (req.body.notifications) {
    Object.keys(req.body.notifications).forEach(key => {
      updates[`preferences.notifications.${key}`] = req.body.notifications[key];
    });
  }
  
  if (req.body.privacy) {
    Object.keys(req.body.privacy).forEach(key => {
      updates[`preferences.privacy.${key}`] = req.body.privacy[key];
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    status: 'success',
    message: 'Preferences updated successfully',
    data: { user }
  });
}));

// Delete user account
router.delete('/account', [
  body('password').notEmpty().withMessage('Password is required for account deletion'),
  body('confirmation').equals('DELETE').withMessage('Please type DELETE to confirm account deletion')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { password } = req.body;

  // Verify password
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
  }

  // Mark user as deleted instead of actually deleting
  await User.findByIdAndUpdate(req.user._id, {
    isActive: false,
    email: `deleted_${Date.now()}_${user.email}`,
    username: `deleted_${Date.now()}_${user.username}`,
    deletedAt: new Date()
  });

  res.json({
    status: 'success',
    message: 'Account deleted successfully. We\'re sorry to see you go! 😢'
  });
}));

// Get user's uploaded mods statistics
router.get('/mods/stats', catchAsync(async (req: Request, res: Response): Promise<any> => {
  const userId = req.user._id;

  // Get all mods uploaded by the user
  const userMods = await Mod.find({ 'author.id': userId, isActive: true });

  if (userMods.length === 0) {
    return res.json({
      status: 'success',
      data: {
        totalMods: 0,
        totalDownloads: 0,
        averageRating: 0
      }
    });
  }

  // Calculate total downloads
  const totalDownloads = userMods.reduce((sum, mod) => sum + (mod.downloads || 0), 0);

  // Calculate average rating
  const modsWithRatings = userMods.filter(mod => mod.rating && mod.ratingCount > 0);
  const averageRating = modsWithRatings.length > 0 
    ? modsWithRatings.reduce((sum, mod) => sum + mod.rating, 0) / modsWithRatings.length
    : 0;

  res.json({
    status: 'success',
    data: {
      totalMods: userMods.length,
      totalDownloads,
      averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
    }
  });
}));

export default router;
