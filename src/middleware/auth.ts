import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Middleware to verify JWT token
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Validate decoded token structure
    if (!decoded || !decoded.id) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid token structure.',
        code: 'INVALID_TOKEN_STRUCTURE'
      });
      return;
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Token is valid but user not found.',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        status: 'error',
        message: 'Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    // Check if user is banned
    if (user.isBanned) {
      res.status(403).json({
        status: 'error',
        message: user.banReason || 'Account is banned.',
        code: 'ACCOUNT_BANNED',
        bannedUntil: user.bannedUntil
      });
      return;
    }

    // Update last active (simplified - don't wait for save)
    user.lastActive = new Date();
    user.save().catch(err => console.error('Failed to update lastActive:', err));

    // Add user to request object
    req.user = user;
    next();

  } catch (error: any) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        status: 'error',
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error in authentication.',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

// Middleware to check if user is admin
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      status: 'error',
      message: 'Admin access required.',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }

  next();
};

// Middleware to check if user is verified
export const verifiedMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.isVerified) {
    res.status(403).json({
      status: 'error',
      message: 'Email verification required.',
      code: 'VERIFICATION_REQUIRED'
    });
    return;
  }

  next();
};

// Optional auth middleware (doesn't fail if no token)
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive && !user.isBanned) {
        user.lastActive = new Date();
        await user.save();
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

// Middleware to check API key for certain endpoints
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.header(process.env.API_KEY_HEADER || 'x-api-key');
  const masterKey = process.env.MASTER_API_KEY;

  if (!apiKey || apiKey !== masterKey) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid API key.',
      code: 'INVALID_API_KEY'
    });
    return;
  }

  next();
};
