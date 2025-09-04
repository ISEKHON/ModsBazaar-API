import express from 'express';
import { Request, Response } from 'express';
import { catchAsync } from '../middleware/errorHandler';

const router = express.Router();

// File upload endpoint
router.post('/mod-files', catchAsync(async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'File upload endpoint - coming soon!',
    data: {
      fileUrl: 'https://example.com/uploads/mod-file.zip'
    }
  });
}));

// Image upload endpoint
router.post('/images', catchAsync(async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Image upload endpoint - coming soon!',
    data: {
      imageUrl: 'https://example.com/uploads/image.jpg'
    }
  });
}));

export default router;
