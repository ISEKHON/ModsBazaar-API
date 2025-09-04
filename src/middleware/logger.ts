import { Request, Response, NextFunction } from 'express';

// Simple request logger middleware
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Get user info if available
  const userInfo = req.user ? ` | User: ${req.user.username}` : '';
  
  // Log request
  console.log(`🌐 ${req.method} ${req.originalUrl}${userInfo} | IP: ${req.ip}`);
  
  // Log response time when request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`${statusColor} ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`);
  });
  
  next();
};
