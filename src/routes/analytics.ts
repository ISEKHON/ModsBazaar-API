import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { User } from '../models/User';
import { Mod } from '../models/Mod';
import { catchAsync, AppError } from '../middleware/errorHandler';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Public analytics (general stats)
router.get('/public', [
  query('period').optional().isIn(['day', 'week', 'month']).withMessage('Invalid period')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { period = 'week' } = req.query;

  // Get public statistics
  const [
    totalMods,
    totalDownloads,
    totalUsers,
    popularMods,
    categoryDistribution,
    gameDistribution
  ] = await Promise.all([
    // Total active mods
    Mod.countDocuments({ isActive: true }),
    
    // Total downloads
    Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]),
    
    // Total active users
    User.countDocuments({ isActive: true }),
    
    // Most popular mods (by downloads)
    Mod.find({ isActive: true })
      .select('name slug thumbnail downloads reviews.averageRating type game category')
      .sort({ downloads: -1 })
      .limit(10)
      .lean(),
    
    // Mods by category
    Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 }, downloads: { $sum: '$downloads' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    
    // Mods by game
    Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$game', count: { $sum: 1 }, downloads: { $sum: '$downloads' } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const analytics = {
    overview: {
      totalMods,
      totalDownloads: totalDownloads[0]?.total || 0,
      totalUsers
    },
    popularMods,
    distribution: {
      categories: categoryDistribution,
      games: gameDistribution
    },
    period,
    lastUpdated: new Date()
  };

  res.json({
    status: 'success',
    data: analytics
  });
}));

// User-specific analytics
router.get('/user', catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Get user analytics
  const [
    userStats,
    downloadsByCategory,
    downloadsByGame,
    monthlyActivity,
    favoriteCategories
  ] = await Promise.all([
    // Basic user stats
    User.aggregate([
      { $match: { _id: req.user._id } },
      {
        $project: {
          totalDownloads: { $size: '$downloadHistory' },
          totalFavorites: { $size: '$favoriteMods' },
          totalPurchases: { $size: '$purchasedMods' },
          totalUnlocks: { $size: '$unlockedMods' },
          memberSince: '$joinedAt',
          totalSpent: 1
        }
      }
    ]),
    
    // Downloads by category
    User.aggregate([
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
      {
        $group: {
          _id: '$modDetails.category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]),
    
    // Downloads by game
    User.aggregate([
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
      {
        $group: {
          _id: '$modDetails.game',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]),
    
    // Monthly download activity (last 12 months)
    User.aggregate([
      { $match: { _id: req.user._id } },
      { $unwind: '$downloadHistory' },
      {
        $match: {
          'downloadHistory.downloadedAt': {
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$downloadHistory.downloadedAt' },
            month: { $month: '$downloadHistory.downloadedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    
    // Favorite categories (from favorited mods)
    User.aggregate([
      { $match: { _id: req.user._id } },
      {
        $lookup: {
          from: 'mods',
          localField: 'favoriteMods',
          foreignField: '_id',
          as: 'favMods'
        }
      },
      { $unwind: '$favMods' },
      {
        $group: {
          _id: '$favMods.category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])
  ]);

  const analytics = {
    overview: userStats[0] || {
      totalDownloads: 0,
      totalFavorites: 0,
      totalPurchases: 0,
      totalUnlocks: 0,
      totalSpent: 0,
      memberSince: req.user.joinedAt
    },
    distribution: {
      downloadsByCategory,
      downloadsByGame,
      favoriteCategories
    },
    activity: {
      monthlyDownloads: monthlyActivity
    },
    lastUpdated: new Date()
  };

  res.json({
    status: 'success',
    data: analytics
  });
}));

// Popular content analytics
router.get('/popular', [
  query('period').optional().isIn(['day', 'week', 'month']).withMessage('Invalid period'),
  query('type').optional().isIn(['mods', 'categories', 'games']).withMessage('Invalid type'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { period = 'week', type = 'mods', limit = 10 } = req.query;
  const limitNum = parseInt(limit as string);

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  let analytics: any;

  switch (type) {
    case 'mods':
      // Get popular mods by recent downloads
      analytics = await User.aggregate([
        { $unwind: '$downloadHistory' },
        {
          $match: {
            'downloadHistory.downloadedAt': { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$downloadHistory.modId',
            recentDownloads: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'mods',
            localField: '_id',
            foreignField: '_id',
            as: 'modDetails'
          }
        },
        { $unwind: '$modDetails' },
        {
          $match: {
            'modDetails.isActive': true
          }
        },
        {
          $project: {
            name: '$modDetails.name',
            slug: '$modDetails.slug',
            thumbnail: '$modDetails.thumbnail',
            type: '$modDetails.type',
            game: '$modDetails.game',
            category: '$modDetails.category',
            totalDownloads: '$modDetails.downloads',
            recentDownloads: 1,
            rating: '$modDetails.reviews.averageRating'
          }
        },
        { $sort: { recentDownloads: -1 } },
        { $limit: limitNum }
      ]);
      break;
      
    case 'categories':
      analytics = await User.aggregate([
        { $unwind: '$downloadHistory' },
        {
          $match: {
            'downloadHistory.downloadedAt': { $gte: startDate }
          }
        },
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
          $match: {
            'modDetails.isActive': true
          }
        },
        {
          $group: {
            _id: '$modDetails.category',
            recentDownloads: { $sum: 1 },
            uniqueMods: { $addToSet: '$downloadHistory.modId' }
          }
        },
        {
          $project: {
            category: '$_id',
            recentDownloads: 1,
            uniqueModsCount: { $size: '$uniqueMods' }
          }
        },
        { $sort: { recentDownloads: -1 } },
        { $limit: limitNum }
      ]);
      break;
      
    case 'games':
      analytics = await User.aggregate([
        { $unwind: '$downloadHistory' },
        {
          $match: {
            'downloadHistory.downloadedAt': { $gte: startDate }
          }
        },
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
          $match: {
            'modDetails.isActive': true
          }
        },
        {
          $group: {
            _id: '$modDetails.game',
            recentDownloads: { $sum: 1 },
            uniqueMods: { $addToSet: '$downloadHistory.modId' }
          }
        },
        {
          $project: {
            game: '$_id',
            recentDownloads: 1,
            uniqueModsCount: { $size: '$uniqueMods' }
          }
        },
        { $sort: { recentDownloads: -1 } },
        { $limit: limitNum }
      ]);
      break;
      
    default:
      analytics = [];
  }

  const result = {
    type,
    period,
    data: analytics,
    lastUpdated: new Date()
  };

  res.json({
    status: 'success',
    data: result
  });
}));

// Get analytics overview (simplified version of old endpoint)
router.get('/overview', catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Get basic overview stats
  const [
    totalMods,
    totalDownloads,
    totalUsers,
    totalRevenue
  ] = await Promise.all([
    Mod.countDocuments({ isActive: true }),
    Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]),
    User.countDocuments({ isActive: true }),
    User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalSpent' } } }
    ])
  ]);

  const overview = {
    downloads: totalDownloads[0]?.total || 0,
    views: totalDownloads[0]?.total || 0, // Using downloads as views for now
    users: totalUsers,
    revenue: totalRevenue[0]?.total || 0
  };

  res.json({
    status: 'success',
    message: 'Analytics overview',
    data: overview
  });
}));

// Admin-only detailed analytics
router.get('/detailed', adminMiddleware, [
  query('metric').optional().isIn(['revenue', 'user_retention', 'conversion', 'engagement']).withMessage('Invalid metric'),
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { metric = 'revenue', period = 'month' } = req.query;

  let analytics: any;

  switch (metric) {
    case 'revenue':
      analytics = await User.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalSpent' },
            avgSpendingPerUser: { $avg: '$totalSpent' },
            payingUsers: {
              $sum: {
                $cond: [{ $gt: ['$totalSpent', 0] }, 1, 0]
              }
            },
            totalUsers: { $sum: 1 }
          }
        },
        {
          $project: {
            totalRevenue: 1,
            avgSpendingPerUser: { $round: ['$avgSpendingPerUser', 2] },
            payingUsers: 1,
            totalUsers: 1,
            conversionRate: {
              $round: [
                { $multiply: [{ $divide: ['$payingUsers', '$totalUsers'] }, 100] },
                2
              ]
            }
          }
        }
      ]);
      break;

    case 'user_retention':
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      analytics = await User.aggregate([
        {
          $facet: {
            newUsers: [
              { $match: { joinedAt: { $gte: thirtyDaysAgo } } },
              { $count: 'count' }
            ],
            activeUsers: [
              { $match: { lastActive: { $gte: sevenDaysAgo } } },
              { $count: 'count' }
            ],
            retainedUsers: [
              {
                $match: {
                  joinedAt: { $gte: thirtyDaysAgo },
                  lastActive: { $gte: sevenDaysAgo }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]);
      break;

    default:
      analytics = { message: 'Metric not implemented yet' };
  }

  res.json({
    status: 'success',
    data: {
      metric,
      period,
      analytics,
      lastUpdated: new Date()
    }
  });
}));

export default router;
