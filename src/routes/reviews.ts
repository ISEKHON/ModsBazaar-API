import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Review } from '../models/Review';
import { Mod } from '../models/Mod';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';

const router = express.Router();

// Get all reviews for a mod
router.get('/:modSlug/reviews', optionalAuthMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { modSlug } = req.params;
  const userId = (req as any).user?._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug: modSlug });
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
router.get('/:modSlug/reviews/my-review', authMiddleware, catchAsync(async (req: Request, res: Response): Promise<any> => {
  const { modSlug } = req.params;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug: modSlug });
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
    data: {
      review
    }
  });
}));

// Create a new review
router.post('/:modSlug/reviews', authMiddleware, [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
    .trim()
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modSlug } = req.params;
  const { rating, comment } = req.body;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug: modSlug });
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
      message: 'You have already reviewed this mod. Use PATCH to update your review.',
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
      newAverageRating: stats.averageRating,
      newRatingCount: stats.totalReviews
    }
  });
}));

// Update a review
router.patch('/:modSlug/reviews/:reviewId', authMiddleware, [
  param('reviewId').isMongoId().withMessage('Invalid review ID'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
    .trim()
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modSlug, reviewId } = req.params;
  const { rating, comment } = req.body;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug: modSlug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find review
  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Check ownership
  if (review.user.toString() !== userId.toString()) {
    return res.status(403).json({
      status: 'error',
      message: 'You can only edit your own reviews',
      code: 'ACCESS_DENIED'
    });
  }

  // Update review
  review.rating = rating;
  review.comment = comment || undefined;
  review.updatedAt = new Date();

  await review.save();

  // Get updated mod stats
  const stats = await Review.calculateModRating(String(mod._id));

  res.json({
    status: 'success',
    message: 'Review updated successfully',
    data: {
      review,
      newAverageRating: stats.averageRating,
      newRatingCount: stats.totalReviews
    }
  });
}));

// Delete a review
router.delete('/:modSlug/reviews/:reviewId', authMiddleware, [
  param('reviewId').isMongoId().withMessage('Invalid review ID')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { modSlug, reviewId } = req.params;
  const userId = (req as any).user._id;

  // Find mod by slug
  const mod = await Mod.findOne({ slug: modSlug });
  if (!mod) {
    return res.status(404).json({
      status: 'error',
      message: 'Mod not found',
      code: 'MOD_NOT_FOUND'
    });
  }

  // Find review
  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Check ownership (allow admins to delete any review)
  const user = (req as any).user;
  if (review.user.toString() !== userId.toString() && user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'You can only delete your own reviews',
      code: 'ACCESS_DENIED'
    });
  }

  // Delete review
  await Review.findByIdAndDelete(reviewId);

  // Get updated mod stats
  const stats = await Review.calculateModRating(String(mod._id));

  res.json({
    status: 'success',
    message: 'Review deleted successfully',
    data: {
      newAverageRating: stats.averageRating,
      newRatingCount: stats.totalReviews
    }
  });
}));

// Vote on a review (separate endpoint for voting)
router.post('/:reviewId/vote', authMiddleware, [
  param('reviewId').isMongoId().withMessage('Invalid review ID'),
  
  body('voteType')
    .isIn(['up', 'down'])
    .withMessage('Vote type must be "up" or "down"')
], catchAsync(async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { reviewId } = req.params;
  const { voteType } = req.body;
  const userId = (req as any).user._id;

  // Find review
  const review = await Review.findById(reviewId).populate('user', 'username');
  if (!review) {
    return res.status(404).json({
      status: 'error',
      message: 'Review not found',
      code: 'REVIEW_NOT_FOUND'
    });
  }

  // Check if user is trying to vote on their own review
  if (review.user._id.toString() === userId.toString()) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot vote on your own review',
      code: 'SELF_VOTE_NOT_ALLOWED'
    });
  }

  // Check existing vote
  const existingVote = review.getUserVote(userId.toString());
  
  if (existingVote === voteType) {
    // Remove vote if same type
    review.removeVote(userId.toString());
    await review.save();
    
    return res.json({
      status: 'success',
      message: 'Vote removed',
      data: {
        review: {
          _id: review._id,
          upvotes: review.upvotes,
          downvotes: review.downvotes,
          userVote: null
        }
      }
    });
  } else {
    // Add or change vote
    review.addVote(userId.toString(), voteType);
    await review.save();
    
    return res.json({
      status: 'success',
      message: 'Vote recorded',
      data: {
        review: {
          _id: review._id,
          upvotes: review.upvotes,
          downvotes: review.downvotes,
          userVote: voteType
        }
      }
    });
  }
}));

export default router;
