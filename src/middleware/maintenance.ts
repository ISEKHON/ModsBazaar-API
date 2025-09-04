import { Request, Response, NextFunction } from 'express';

// Maintenance mode middleware
export const maintenanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip maintenance check for health endpoint and admin routes
  if (req.path === '/health' || req.path.startsWith('/api/admin/maintenance')) {
    return next();
  }

  // Check if maintenance mode is enabled
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  
  if (maintenanceMode) {
    const maintenanceMessage = process.env.MAINTENANCE_MESSAGE || 
      'ModsBazaar is currently under maintenance. We\'ll be back soon! 🎮';

    res.status(503).json({
      status: 'maintenance',
      message: maintenanceMessage,
      code: 'MAINTENANCE_MODE',
      timestamp: new Date().toISOString(),
      estimatedDowntime: '30 minutes' // You can make this dynamic
    });
    return;
  }

  next();
};
