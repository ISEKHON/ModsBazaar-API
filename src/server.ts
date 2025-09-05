import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import configurations
import { connectDB } from './config/database';
import { initRedis } from './config/redis';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { maintenanceMiddleware } from './middleware/maintenance';
import { loggerMiddleware } from './middleware/logger';

// Import routes
import authRoutes from './routes/auth';
import modRoutes from './routes/mods';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payment';
import analyticsRoutes from './routes/analytics';
import submissionRoutes from './routes/submissions';
import reviewRoutes from './routes/reviews';

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('🔍 Environment Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI_PROD exists:', !!process.env.MONGODB_URI_PROD);
console.log('Current working directory:', process.cwd());

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting (disabled in development if DISABLE_RATE_LIMIT is set)
if (process.env.NODE_ENV !== 'development' || !process.env.DISABLE_RATE_LIMIT) {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX!) || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
}

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    process.env.FRONTEND_URL_PROD || "https://mods-bazaar.vercel.app",
    "https://www.modsbazaar.me"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Compression for better performance
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data against NoSQL injection attacks
app.use(mongoSanitize());

// Custom middleware
app.use(loggerMiddleware);
app.use(maintenanceMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ModsBazaar Backend is running smoothly! 🎮',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mods', modRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/reviews', reviewRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found on ModsBazaar server`,
    availableRoutes: [
      '/api/auth',
      '/api/mods', 
      '/api/user',
      '/api/admin',
      '/api/upload',
      '/api/payment',
      '/api/analytics',
      '/api/submissions'
    ]
  });
});

// Global error handling
app.use(errorHandler);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  // Join user to their personal room for notifications
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`👤 User ${userId} joined their room`);
  });

  // Real-time mod download notifications
  socket.on('mod-downloaded', (data) => {
    io.emit('download-update', {
      modId: data.modId,
      downloads: data.newDownloadCount
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Database and Redis connection
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('📦 MongoDB connected successfully');

    // Initialize Redis
    const redisConnected = await initRedis();
    if (redisConnected) {
      console.log('🔴 Redis connected successfully');
    } else {
      console.log('⚠️ Redis not available - running without cache');
    }

    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 ModsBazaar Backend running on port ${PORT}`);
      console.log(`🌟 Environment: ${process.env.NODE_ENV}`);
      console.log(`🎮 Gaming mod store backend is ready!`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔗 Local server: http://localhost:${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated');
  });
});

// Export for testing
export { app, io };

// Start the server
startServer();
