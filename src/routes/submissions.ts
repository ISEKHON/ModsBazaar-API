import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { body, validationResult, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { ModSubmission } from '../models/ModSubmission';
import { Mod } from '../models/Mod';
import { User } from '../models/User';
import { authMiddleware, adminMiddleware, verifiedMiddleware } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';

const router = express.Router();

// Rate limiting for submissions
const submissionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: process.env.DISABLE_RATE_LIMIT ? 1000 : 40, // 3 submissions per day
  message: {
    status: 'error',
    message: 'Too many submissions today. Please wait 24 hours before submitting again.',
    code: 'SUBMISSION_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules for mod submission
const submitModValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Mod name must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 50, max: 2000 })
    .withMessage('Description must be between 50 and 2000 characters'),
  
  body('shortDescription')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Short description must be between 10 and 200 characters'),
  
  body('type')
    .isIn(['free', 'paid', 'unlock'])
    .withMessage('Type must be free, paid, or unlock'),
  
  body('price')
    .optional()
    .isFloat({ min: 0, max: 999.99 })
    .withMessage('Price must be between 0 and 999.99'),
  
  body('unlockCode')
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage('Unlock code must be between 6 and 50 characters'),
  
  body('version')
    .matches(/^\d+\.\d+\.\d+$/)
    .withMessage('Version must be in format x.y.z (e.g., 1.0.0)'),
  
  body('game')
    .isIn(['FS22', 'FS25', 'Both'])
    .withMessage('Game must be FS22, FS25, or Both'),
  
  body('category')
    .isIn(['Tractors', 'Harvesters', 'Implements', 'Trailers', 'Trucks', 'Maps', 'Buildings', 'Animals', 'Textures', 'Scripts', 'Other'])
    .withMessage('Invalid category'),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),
  
  body('thumbnail')
    .isURL()
    .matches(/\.(jpg|jpeg|png|webp)$/i)
    .withMessage('Thumbnail must be a valid image URL'),
  
  body('screenshots')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Screenshots must be an array with maximum 5 items'),
  
  body('screenshots.*')
    .optional()
    .isURL()
    .matches(/\.(jpg|jpeg|png|webp)$/i)
    .withMessage('Screenshots must be valid image URLs'),
  
  body('videoUrl')
    .optional({ checkFalsy: true })
    .isURL()
    .matches(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/)
    .withMessage('Video URL must be a valid YouTube URL'),
  
  body('downloadUrl')
    .isURL()
    .withMessage('Download URL must be a valid URL'),
  
  body('fileSize')
    .optional()
    .matches(/^\d+(\.\d+)?\s*(B|KB|MB|GB)$/i)
    .withMessage('File size must be in format like "45.2 MB"'),
  
  body('requirements')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Requirements must be an array with maximum 20 items'),
  
  body('dependencies')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Dependencies must be an array with maximum 20 items'),
  
  body('conflicts')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Conflicts must be an array with maximum 20 items')
];

// Submit a new mod for review
router.post('/', authMiddleware, verifiedMiddleware, submissionLimiter, submitModValidation, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const submissionData = {
    ...req.body,
    submittedBy: (req as any).user._id,
    status: 'pending'
  };

  // Clear price and unlockCode based on type
  if (submissionData.type === 'free') {
    submissionData.price = undefined;
    submissionData.unlockCode = undefined;
  } else if (submissionData.type === 'unlock') {
    submissionData.price = undefined;
  } else if (submissionData.type === 'paid') {
    submissionData.unlockCode = undefined;
  }

  // Additional validation for paid/unlock mods
  if (submissionData.type === 'paid' && (!submissionData.price || submissionData.price <= 0)) {
    return res.status(400).json({
      status: 'error',
      message: 'Price is required for paid mods'
    });
  }

  if (submissionData.type === 'unlock' && !submissionData.unlockCode) {
    return res.status(400).json({
      status: 'error',
      message: 'Unlock code is required for unlock mods'
    });
  }

  const submission = new ModSubmission(submissionData);
  await submission.save();

  res.status(201).json({
    status: 'success',
    message: 'Mod submitted successfully! It will be reviewed by our team.',
    data: { submission }
  });
}));

// Get user's submissions
router.get('/my-submissions', authMiddleware, catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  console.log('Getting submissions for user:', userId);
  
  const submissions = await ModSubmission.find({ submittedBy: userId })
    .populate('publishedModId', 'slug name isActive')
    .sort({ submittedAt: -1 })
    .lean();
  console.log('Found submissions:', submissions.length);
  
  res.json({
    status: 'success',
    data: { submissions: submissions || [] }
  });
}));

// Get a specific submission (own submissions only for users, any for admins)
router.get('/:id', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const submission = await ModSubmission.findById(req.params.id)
    .populate('submittedBy', 'username email gamerTag')
    .populate('reviewedBy', 'username')
    .populate('publishedModId', 'slug name');

  if (!submission) {
    return res.status(404).json({
      status: 'error',
      message: 'Submission not found',
      code: 'SUBMISSION_NOT_FOUND'
    });
  }

  // Check permissions
  const user = (req as any).user;
  if (user.role !== 'admin' && submission.submittedBy._id.toString() !== user._id.toString()) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  res.json({
    status: 'success',
    data: { submission }
  });
}));

// Update a submission (only if pending and owner)
router.patch('/:id', authMiddleware, verifiedMiddleware, submitModValidation, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const submission = await ModSubmission.findById(req.params.id);
  
  if (!submission) {
    return res.status(404).json({
      status: 'error',
      message: 'Submission not found',
      code: 'SUBMISSION_NOT_FOUND'
    });
  }

  if (!submission.canBeEditedBy((req as any).user._id)) {
    return res.status(403).json({
      status: 'error',
      message: 'Cannot edit this submission',
      code: 'CANNOT_EDIT'
    });
  }

  // Clear price and unlockCode based on type
  const updateData = { ...req.body };
  if (updateData.type === 'free') {
    updateData.price = undefined;
    updateData.unlockCode = undefined;
  } else if (updateData.type === 'unlock') {
    updateData.price = undefined;
  } else if (updateData.type === 'paid') {
    updateData.unlockCode = undefined;
  }

  // Update fields
  Object.assign(submission, updateData);
  submission.updatedAt = new Date();
  
  await submission.save();

  res.json({
    status: 'success',
    message: 'Submission updated successfully',
    data: { submission }
  });
}));

// Delete a submission (only if pending and owner)
router.delete('/:id', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const submission = await ModSubmission.findById(req.params.id);
  
  if (!submission) {
    return res.status(404).json({
      status: 'error',
      message: 'Submission not found',
      code: 'SUBMISSION_NOT_FOUND'
    });
  }

  if (!submission.canBeEditedBy((req as any).user._id)) {
    return res.status(403).json({
      status: 'error',
      message: 'Cannot delete this submission',
      code: 'CANNOT_DELETE'
    });
  }

  await ModSubmission.findByIdAndDelete(req.params.id);

  res.json({
    status: 'success',
    message: 'Submission deleted successfully'
  });
}));

// Admin routes

// Get all pending submissions for review
router.get('/admin/pending', authMiddleware, adminMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
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

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    ModSubmission.find({ status: 'pending' })
      .populate('submittedBy', 'username email gamerTag joinedAt')
      .sort({ submittedAt: 1 })
      .skip(skip)
      .limit(limit),
    ModSubmission.countDocuments({ status: 'pending' })
  ]);

  res.json({
    status: 'success',
    data: { 
      submissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }
  });
}));

// Review a submission (approve/reject)
router.patch('/admin/:id/review', authMiddleware, adminMiddleware, [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  
  body('reviewNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Review notes cannot exceed 1000 characters'),
  
  body('rejectionReason')
    .if(body('action').equals('reject'))
    .notEmpty()
    .isLength({ max: 500 })
    .withMessage('Rejection reason is required and cannot exceed 500 characters')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { action, reviewNotes, rejectionReason } = req.body;
  const submission = await ModSubmission.findById(req.params.id);

  if (!submission) {
    return res.status(404).json({
      status: 'error',
      message: 'Submission not found',
      code: 'SUBMISSION_NOT_FOUND'
    });
  }

  if (submission.status !== 'pending') {
    return res.status(400).json({
      status: 'error',
      message: 'Submission already reviewed',
      code: 'ALREADY_REVIEWED'
    });
  }

  submission.status = action === 'approve' ? 'approved' : 'rejected';
  submission.reviewedBy = (req as any).user._id;
  submission.reviewedAt = new Date();
  submission.reviewNotes = reviewNotes;
  
  if (action === 'reject') {
    submission.rejectionReason = rejectionReason;
  }

  await submission.save();

  // If approved, optionally auto-publish (or require separate publish step)
  let publishedMod = null;
  if (action === 'approve') {
    // Get the original submitter's information
    const originalSubmitter = await User.findById(submission.submittedBy);
    if (!originalSubmitter) {
      return res.status(400).json({
        status: 'error',
        message: 'Original submitter not found',
        code: 'SUBMITTER_NOT_FOUND'
      });
    }

    // Create the actual mod from submission
    const modData = {
      name: submission.name,
      slug: submission.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: submission.description,
      shortDescription: submission.shortDescription,
      type: submission.type,
      price: submission.price,
      unlockCode: submission.unlockCode,
      version: submission.version,
      game: submission.game,
      category: submission.category,
      tags: submission.tags,
      thumbnail: submission.thumbnail,
      screenshots: submission.screenshots,
      videoUrl: submission.videoUrl,
      files: [{
        name: `${submission.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
        size: submission.fileSize || 'Unknown',
        downloadUrl: submission.downloadUrl,
        uploadedAt: new Date()
      }],
      author: {
        name: originalSubmitter.username,
        id: submission.submittedBy
      },
      downloads: 0,
      views: 0,
      rating: 0,
      ratingCount: 0,
      reviews: [],
      compatibility: {
        requirements: submission.requirements || [],
        dependencies: submission.dependencies || [],
        conflicts: submission.conflicts || []
      },
      isActive: true,
      isFeatured: false,
      publishedAt: new Date(),
      seo: {
        keywords: submission.tags || []
      },
      analytics: {
        views: 0,
        downloads: 0
      }
    };

    publishedMod = new Mod(modData);
    await publishedMod.save();

    // Link the published mod to the submission
    submission.publishedModId = publishedMod._id as mongoose.Types.ObjectId;
    submission.status = 'published';
    await submission.save();
  }

  res.json({
    status: 'success',
    message: `Submission ${action}d successfully${publishedMod ? ' and published' : ''}`,
    data: { 
      submission,
      publishedMod: publishedMod ? { _id: publishedMod._id, slug: publishedMod.slug } : null
    }
  });
}));

// Get all submissions with filters (admin only)
router.get('/admin/all', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'published']).withMessage('Invalid status'),
  query('submittedBy').optional().isMongoId().withMessage('Invalid submitter ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
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

  const { status, submittedBy } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (status) filter.status = status;
  if (submittedBy) filter.submittedBy = submittedBy;

  const [submissions, total] = await Promise.all([
    ModSubmission.find(filter)
      .populate('submittedBy', 'username email gamerTag')
      .populate('reviewedBy', 'username')
      .populate('publishedModId', 'slug name')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    ModSubmission.countDocuments(filter)
  ]);

  res.json({
    status: 'success',
    data: { 
      submissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }
  });
}));

export default router;
