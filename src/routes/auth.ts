import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Rate limiting for auth endpoints (conditional for development)
const authLimiter = process.env.DISABLE_RATE_LIMIT ? 
  (req: any, res: any, next: any) => next() : // Skip rate limiting
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX!) || 1000, // Use env var or high default for testing
    message: {
      status: 'error',
      message: 'Too many authentication attempts, please try again later.',
      code: 'TOO_MANY_ATTEMPTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores')
    .custom(async (username) => {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new Error('Username already exists');
      }
    }),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
    .custom(async (email) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email already registered');
      }
    }),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('gamerTag')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Gamer tag cannot exceed 30 characters'),
  body('favoriteGame')
    .optional()
    .isIn(['FS22', 'FS25', 'Both'])
    .withMessage('Favorite game must be FS22, FS25, or Both')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Generate JWT token
const generateToken = (userId: string, email: string, role: string): string => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  return jwt.sign(
    { 
      id: userId, 
      email, 
      role,
      iat: Math.floor(Date.now() / 1000)
    },
    secret,
    { expiresIn: '7d' }
  );
};

// Register new user
router.post('/register', authLimiter, registerValidation, catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { username, email, password, gamerTag, favoriteGame } = req.body;

  // Create new user
  const user = new User({
    username,
    email,
    password,
    gamerTag: gamerTag || username,
    favoriteGame: favoriteGame || 'Both',
    isVerified: true, // Auto-verify for now
    joinedAt: new Date(),
    lastActive: new Date(),
    lastPasswordChange: new Date(), // Set initial password change date
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

  // Generate token
  const token = generateToken(String(user._id), user.email, user.role);

  // Remove password from response
  const userResponse = user.toObject() as any;
  delete userResponse.password;

  res.status(201).json({
    status: 'success',
    message: 'Registration successful! Welcome to ModsBazaar! 🎮',
    data: {
      token,
      user: userResponse
    }
  });
}));

// Login user
router.post('/login', authLimiter, loginValidation, catchAsync(async (req: Request, res: Response): Promise<any> => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact support.', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Check if user is banned
  if (user.isBanned) {
    const message = user.banReason || 'Account is banned.';
    const bannedUntil = user.bannedUntil;
    
    throw new AppError(
      bannedUntil 
        ? `${message} Ban expires: ${bannedUntil.toISOString()}`
        : message,
      403, 
      'ACCOUNT_BANNED'
    );
  }

  // Update last active
  user.lastActive = new Date();
  await user.save();

  // Generate token
  const token = generateToken(String(user._id), user.email, user.role);

  // Remove password from response
  const userResponse = user.toObject() as any;
  delete userResponse.password;

  res.json({
    status: 'success',
    message: 'Login successful! Welcome back to ModsBazaar! 🎮',
    data: {
      token,
      user: userResponse
    }
  });
}));

// Get current user profile
router.get('/me', authMiddleware, catchAsync(async (req: Request, res: Response) => {
  // Ensure user exists from middleware
  if (!req.user || !req.user._id) {
    throw new AppError('User not found in request', 401, 'USER_NOT_IN_REQUEST');
  }

  const userId = req.user._id.toString();
  
  // Simplified query without populate to isolate the issue
  const user = await User.findById(userId).select('-password');

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    status: 'success',
    data: { user }
  });
}));

// Update user profile
router.patch('/me', authMiddleware, [
  body('username')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('gamerTag')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Gamer tag cannot exceed 30 characters'),
  body('favoriteGame')
    .optional()
    .isIn(['FS22', 'FS25', 'Both'])
    .withMessage('Favorite game must be FS22, FS25, or Both'),
  body('preferences.theme')
    .optional()
    .isIn(['dark', 'light'])
    .withMessage('Theme must be dark or light'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be boolean'),
  body('preferences.notifications.newMods')
    .optional()
    .isBoolean()
    .withMessage('New mods notification preference must be boolean'),
  body('preferences.notifications.updates')
    .optional()
    .isBoolean()
    .withMessage('Updates notification preference must be boolean'),
  body('preferences.privacy.showProfile')
    .optional()
    .isBoolean()
    .withMessage('Show profile preference must be boolean'),
  body('preferences.privacy.showDownloads')
    .optional()
    .isBoolean()
    .withMessage('Show downloads preference must be boolean')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const allowedFields = ['username', 'gamerTag', 'favoriteGame', 'preferences'];
  const updates: any = {};

  // Only include allowed fields
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Check if username is being changed and if it's available
  if (updates.username) {
    const existingUser = await User.findOne({ 
      username: updates.username,
      _id: { $ne: (req as any).user._id }
    });
    
    if (existingUser) {
      throw new AppError('Username already taken', 400, 'USERNAME_TAKEN');
    }
  }

  const user = await User.findByIdAndUpdate(
    (req as any).user._id,
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: { user }
  });
}));

// Change password
router.patch('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('New password must be between 6 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById((req as any).user._id).select('+password');

  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 401, 'INCORRECT_PASSWORD');
  }

  user.password = newPassword;
  user.lastPasswordChange = new Date();
  await user.save();

  res.json({
    status: 'success',
    message: 'Password changed successfully'
  });
}));

// Logout (client-side token removal)
router.post('/logout', authMiddleware, catchAsync(async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Logged out successfully. See you next time! 👋'
  });
}));

// Refresh token
router.post('/refresh', authMiddleware, catchAsync(async (req: Request, res: Response) => {
  const token = generateToken((req as any).user._id.toString(), (req as any).user.email, (req as any).user.role);

  res.json({
    status: 'success',
    message: 'Token refreshed successfully',
    data: { token }
  });
}));

// Check username availability
router.get('/check-username/:username', [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores')
], catchAsync(async (req: Request, res: Response) => {
  const { username } = req.params;

  const existingUser = await User.findOne({ username });
  const available = !existingUser;

  res.json({
    status: 'success',
    data: {
      username,
      available
    }
  });
}));

// Check email availability
router.get('/check-email/:email', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;

  const existingUser = await User.findOne({ email });
  const available = !existingUser;

  res.json({
    status: 'success',
    data: {
      email,
      available
    }
  });
}));

export default router;
