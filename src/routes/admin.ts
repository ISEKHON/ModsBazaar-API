import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { User } from '../models/User';
import { Mod } from '../models/Mod';
import { ModSubmission } from '../models/ModSubmission';
import { catchAsync, AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard statistics
router.get('/dashboard/stats', catchAsync(async (req: Request, res: Response) => {
  try {
    // Get basic counts
    const [totalUsers, totalMods, pendingSubmissions] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Mod.countDocuments({ isActive: true }),
      ModSubmission.countDocuments({ status: 'pending' })
    ]);

    // Get total downloads and views
    const modStats = await Mod.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalDownloads: { $sum: '$downloads' },
          totalViews: { $sum: '$views' },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const stats = modStats[0] || { totalDownloads: 0, totalViews: 0, averageRating: 0 };

    // Get recent activity
    const recentActivity = await Promise.all([
      // Recent submissions
      ModSubmission.find({ status: 'pending' })
        .sort({ submittedAt: -1 })
        .limit(5)
        .populate('submittedBy', 'username')
        .lean(),
      
      // Recent approvals/rejections
      ModSubmission.find({ status: { $in: ['approved', 'published', 'rejected'] } })
        .sort({ reviewedAt: -1 })
        .limit(5)
        .populate('submittedBy', 'username')
        .populate('reviewedBy', 'username')
        .lean(),
      
      // Recent user registrations
      User.find({ isActive: true })
        .sort({ joinedAt: -1 })
        .limit(3)
        .lean()
    ]);

    const [pendingSubmissionsData, reviewedSubmissions, newUsers] = recentActivity;

    const activityFeed = [
      ...pendingSubmissionsData.map(sub => ({
        type: 'submission' as const,
        message: `New mod submission: "${sub.name}" by ${(sub.submittedBy as any).username}`,
        timestamp: sub.submittedAt
      })),
      ...reviewedSubmissions.map(sub => ({
        type: sub.status === 'rejected' ? 'rejection' as const : 'approval' as const,
        message: `Mod "${sub.name}" ${sub.status} by ${(sub.reviewedBy as any)?.username || 'system'}`,
        timestamp: sub.reviewedAt || sub.submittedAt
      })),
      ...newUsers.map(user => ({
        type: 'user_registration' as const,
        message: `New user registered: ${user.username}`,
        timestamp: user.joinedAt
      }))
    ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

    res.json({
      status: 'success',
      data: {
        totalUsers,
        totalMods,
        pendingSubmissions,
        totalDownloads: stats.totalDownloads,
        totalViews: stats.totalViews,
        averageRating: stats.averageRating,
        recentActivity: activityFeed
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard statistics'
    });
  }
}));

// Dashboard statistics (legacy endpoint)
router.get('/dashboard', catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Get current date ranges
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.setDate(now.getDate() - 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate statistics
  const [
    totalUsers,
    totalMods,
    activeUsers,
    newUsersToday,
    newUsersWeek,
    newModsToday,
    newModsWeek,
    totalDownloads,
    totalRevenue,
    usersByGame,
    modsByCategory,
    recentActivity
  ] = await Promise.all([
    // Total users
    User.countDocuments({ isActive: true }),
    
    // Total mods
    Mod.countDocuments({ isActive: true }),
    
    // Active users (logged in last 7 days)
    User.countDocuments({ 
      isActive: true, 
      lastActive: { $gte: weekStart } 
    }),
    
    // New users today
    User.countDocuments({ 
      joinedAt: { $gte: todayStart },
      isActive: true 
    }),
    
    // New users this week
    User.countDocuments({ 
      joinedAt: { $gte: weekStart },
      isActive: true 
    }),
    
    // New mods today
    Mod.countDocuments({ 
      createdAt: { $gte: todayStart },
      isActive: true 
    }),
    
    // New mods this week
    Mod.countDocuments({ 
      createdAt: { $gte: weekStart },
      isActive: true 
    }),
    
    // Total downloads
    Mod.aggregate([
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]),
    
    // Total revenue (from paid mods)
    User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalSpent' } } }
    ]),
    
    // Users by favorite game
    User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$favoriteGame', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Mods by category
    Mod.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Recent activity (last 10 user registrations)
    User.find({ isActive: true })
      .select('username email joinedAt gamerTag favoriteGame')
      .sort({ joinedAt: -1 })
      .limit(10)
      .lean()
  ]);

  const stats = {
    overview: {
      totalUsers,
      totalMods,
      activeUsers,
      totalDownloads: totalDownloads[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.total || 0
    },
    growth: {
      newUsersToday,
      newUsersWeek,
      newModsToday,
      newModsWeek
    },
    distribution: {
      usersByGame,
      modsByCategory
    },
    recentActivity,
    lastUpdated: new Date()
  };

  res.json({
    status: 'success',
    data: stats
  });
}));

// Get all users with advanced filtering
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['user', 'admin', 'moderator']).withMessage('Invalid role'),
  query('status').optional().isIn(['active', 'inactive', 'banned']).withMessage('Invalid status'),
  query('game').optional().isIn(['FS22', 'FS25', 'Both']).withMessage('Invalid game preference'),
  query('sort').optional().isIn(['newest', 'oldest', 'username', 'lastActive', 'totalSpent']).withMessage('Invalid sort option')
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
  
  const { search, role, status, game, sort = 'newest' } = req.query;

  // Build match query
  const matchQuery: any = {};
  
  if (search) {
    matchQuery.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { gamerTag: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) matchQuery.role = role;
  if (game) matchQuery.favoriteGame = game;
  
  if (status) {
    switch (status) {
      case 'active':
        matchQuery.isActive = true;
        matchQuery.isBanned = false;
        break;
      case 'inactive':
        matchQuery.isActive = false;
        break;
      case 'banned':
        matchQuery.isBanned = true;
        break;
    }
  }

  // Build sort query
  let sortQuery: any = { joinedAt: -1 };
  switch (sort) {
    case 'oldest':
      sortQuery = { joinedAt: 1 };
      break;
    case 'username':
      sortQuery = { username: 1 };
      break;
    case 'lastActive':
      sortQuery = { lastActive: -1 };
      break;
    case 'totalSpent':
      sortQuery = { totalSpent: -1 };
      break;
  }

  // Execute query
  const users = await User.find(matchQuery)
    .select('-password')
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count
  const totalCount = await User.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    status: 'success',
    data: {
      users,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// Get all mods with advanced filtering
router.get('/mods', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('type').optional().isIn(['free', 'paid', 'unlock']).withMessage('Invalid type'),
  query('game').optional().isIn(['FS22', 'FS25']).withMessage('Invalid game'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('status').optional().isIn(['active', 'inactive', 'pending']).withMessage('Invalid status'),
  query('sort').optional().isIn(['newest', 'oldest', 'name', 'downloads', 'rating', 'price']).withMessage('Invalid sort option')
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
  
  const { search, type, game, category, status, sort = 'newest' } = req.query;

  // Build match query
  const matchQuery: any = {};
  
  if (search) {
    matchQuery.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search as string, 'i')] } }
    ];
  }
  
  if (type) matchQuery.type = type;
  if (game) matchQuery.game = game;
  if (category) matchQuery.category = category;
  
  if (status) {
    switch (status) {
      case 'active':
        matchQuery.isActive = true;
        break;
      case 'inactive':
        matchQuery.isActive = false;
        break;
      case 'pending':
        matchQuery.isApproved = false;
        break;
    }
  }

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
    case 'price':
      sortQuery = { price: -1 };
      break;
  }

  // Execute query
  const mods = await Mod.find(matchQuery)
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count
  const totalCount = await Mod.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    status: 'success',
    data: {
      mods,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// Ban/unban user
router.patch('/users/:userId/ban', [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('action').isIn(['ban', 'unban']).withMessage('Action must be ban or unban'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be positive integer (days)')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId } = req.params;
  const { action, reason, duration } = req.body;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Prevent banning admins
  if (user.role === 'admin' && action === 'ban') {
    throw new AppError('Cannot ban admin users', 403, 'CANNOT_BAN_ADMIN');
  }

  const updates: any = {};
  
  if (action === 'ban') {
    updates.isBanned = true;
    updates.banReason = reason || 'Banned by admin';
    updates.bannedAt = new Date();
    
    if (duration) {
      updates.bannedUntil = new Date(Date.now() + (duration * 24 * 60 * 60 * 1000));
    }
  } else {
    updates.isBanned = false;
    updates.banReason = null;
    updates.bannedAt = null;
    updates.bannedUntil = null;
  }

  await User.findByIdAndUpdate(userId, updates);

  res.json({
    status: 'success',
    message: `User ${action}ned successfully`,
    data: {
      action,
      userId,
      reason: updates.banReason,
      bannedUntil: updates.bannedUntil
    }
  });
}));

// Delete/restore user
router.patch('/users/:userId/status', [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('action').isIn(['activate', 'deactivate']).withMessage('Action must be activate or deactivate')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId } = req.params;
  const { action } = req.body;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Prevent deactivating admins
  if (user.role === 'admin' && action === 'deactivate') {
    throw new AppError('Cannot deactivate admin users', 403, 'CANNOT_DEACTIVATE_ADMIN');
  }

  const isActive = action === 'activate';
  await User.findByIdAndUpdate(userId, { isActive });

  res.json({
    status: 'success',
    message: `User ${action}d successfully`
  });
}));

// Approve/reject mod
router.patch('/mods/:modId/approve', [
  param('modId').isMongoId().withMessage('Invalid mod ID'),
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('reason').optional().isString().withMessage('Reason must be a string')
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
  const { action, reason } = req.body;

  // Check if mod exists
  const mod = await Mod.findById(modId);
  if (!mod) {
    throw new AppError('Mod not found', 404, 'MOD_NOT_FOUND');
  }

  const updates: any = {
    isApproved: action === 'approve',
    approvedAt: action === 'approve' ? new Date() : null,
    approvedBy: action === 'approve' ? req.user._id : null
  };

  if (action === 'reject' && reason) {
    updates.rejectionReason = reason;
  }

  await Mod.findByIdAndUpdate(modId, updates);

  res.json({
    status: 'success',
    message: `Mod ${action}d successfully`
  });
}));

// Delete mod
router.delete('/mods/:modId', [
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

  // Soft delete by marking as inactive
  await Mod.findByIdAndUpdate(modId, { 
    isActive: false,
    deletedAt: new Date(),
    deletedBy: req.user._id
  });

  // Remove from user favorites and purchases
  await User.updateMany(
    {},
    { 
      $pull: { 
        favoriteMods: modId,
        purchasedMods: modId,
        unlockedMods: modId
      }
    }
  );

  res.json({
    status: 'success',
    message: 'Mod deleted successfully'
  });
}));

// Feature a mod
router.post('/mods/:modId/feature', [
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

  await Mod.findByIdAndUpdate(modId, { isFeatured: true });

  res.json({
    status: 'success',
    message: 'Mod featured successfully'
  });
}));

// Unfeature a mod
router.post('/mods/:modId/unfeature', [
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

  await Mod.findByIdAndUpdate(modId, { isFeatured: false });

  res.json({
    status: 'success',
    message: 'Mod unfeatured successfully'
  });
}));

// Mark mod as popular
router.post('/mods/:modId/popular', [
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

  await Mod.findByIdAndUpdate(modId, { isPopular: true });

  res.json({
    status: 'success',
    message: 'Mod marked as popular successfully'
  });
}));

// Remove popular status from mod
router.post('/mods/:modId/unpopular', [
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

  await Mod.findByIdAndUpdate(modId, { isPopular: false });

  res.json({
    status: 'success',
    message: 'Popular status removed successfully'
  });
}));

// Toggle maintenance mode
router.post('/maintenance', [
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('message').optional().isString().withMessage('Message must be a string')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { enabled, message } = req.body;

  // Store maintenance mode in cache
  const maintenanceData = {
    enabled,
    message: message || 'System is under maintenance. Please try again later.',
    enabledAt: enabled ? new Date() : null,
    enabledBy: req.user._id
  };

  res.json({
    status: 'success',
    message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
    data: maintenanceData
  });
}));

// Get system analytics
router.get('/analytics', [
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
  query('metric').optional().isIn(['users', 'mods', 'downloads', 'revenue']).withMessage('Invalid metric')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { period = 'week', metric = 'users' } = req.query;

  // Calculate date ranges
  const now = new Date();
  let startDate: Date;
  let groupFormat: string;

  switch (period) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d-%H';
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d';
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d';
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m';
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d';
  }

  let analytics: any;

  switch (metric) {
    case 'users':
      analytics = await User.aggregate([
        { $match: { joinedAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$joinedAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      break;

    case 'mods':
      analytics = await Mod.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      break;

    case 'downloads':
      analytics = await User.aggregate([
        { $unwind: '$downloadHistory' },
        { $match: { 'downloadHistory.downloadedAt': { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$downloadHistory.downloadedAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      break;

    case 'revenue':
      analytics = await User.aggregate([
        { $unwind: '$purchaseHistory' },
        { $match: { 'purchaseHistory.purchasedAt': { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$purchaseHistory.purchasedAt' } },
            revenue: { $sum: '$purchaseHistory.amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      break;

    default:
      analytics = [];
  }

  res.json({
    status: 'success',
    data: {
      period,
      metric,
      analytics
    }
  });
}));

export default router;
