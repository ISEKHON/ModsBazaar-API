import express from 'express';
import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { catchAsync } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { Mod } from '../models/Mod';
import { User } from '../models/User';

const router = express.Router();

// Process payment for mod
router.post('/process', catchAsync(async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Payment processing endpoint - coming soon!',
    data: {
      paymentId: 'pay_123456789',
      status: 'completed'
    }
  });
}));

// Unlock mod with code
router.post('/unlock', [
  authMiddleware,
  body('modId').isMongoId().withMessage('Invalid mod ID'),
  body('unlockCode').notEmpty().withMessage('Unlock code is required')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modId, unlockCode } = req.body;
  const userId = (req as any).user._id;

  // Find the mod
  const mod = await Mod.findById(modId);
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found'
    });
  }

  // Check if mod requires unlock code
  if (mod.type !== 'unlock') {
    return res.status(400).json({
      status: 'error',
      message: 'This mod does not require an unlock code'
    });
  }

  // Check if the unlock code matches
  if (mod.unlockCode !== unlockCode) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid unlock code'
    });
  }

  // Find the user and add the mod to their unlocked mods
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found'
    });
  }

  // Check if already unlocked
  if (user.unlockedMods?.includes(modId)) {
    return res.status(400).json({
      status: 'error',
      message: 'You have already unlocked this mod'
    });
  }

  // Add to user's unlocked mods
  user.unlockedMods = user.unlockedMods || [];
  user.unlockedMods.push(modId);
  await user.save();

  res.json({
    status: 'success',
    message: 'Mod unlocked successfully! You can now download it.',
    data: {
      unlocked: true,
      modName: mod.name
    }
  });
}));

export default router;
