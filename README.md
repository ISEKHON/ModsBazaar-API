# ModsBazaar Backend 🎮

Super fast and smooth backend for ModsBazaar - Gaming Mod Store for Farming Simulator 22/25.

## 🚀 Features

- **Three-Tier Mod System**: Free, Paid, and Unlock with Code
- **MongoDB Database**: Fast document-based storage
- **JWT Authentication**: Secure user authentication
- **Express.js**: High-performance Node.js framework
- **TypeScript**: Type-safe development
- **Redis Caching**: Optional fast caching layer
- **File Upload Support**: Mod files and images
- **Rate Limiting**: Protection against abuse
- **Error Handling**: Comprehensive error management
- **Maintenance Mode**: System-wide maintenance control

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT tokens
- **Caching**: Redis (optional)
- **File Handling**: Multer + Cloudinary
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/         # Database and Redis configuration
│   ├── middleware/     # Auth, error handling, logging
│   ├── models/         # MongoDB schemas (User, Mod)
│   ├── routes/         # API endpoints
│   └── server.ts       # Main server file
├── package.json
├── tsconfig.json
└── .env               # Environment variables
```

## 🔧 Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env` and configure:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/modsbazaar
   JWT_SECRET=your-secret-key
   FRONTEND_URL=http://localhost:3000
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## 🌐 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user profile
- `PATCH /me` - Update user profile
- `POST /logout` - Logout user

### Mods (`/api/mods`)
- `GET /` - Get all mods (with filtering)
- `GET /featured` - Get featured mods
- `GET /popular` - Get popular mods
- `GET /:slug` - Get single mod details

### User (`/api/user`)
- `GET /profile` - Get user profile
- `PATCH /preferences` - Update preferences

### Admin (`/api/admin`)
- `GET /dashboard` - Admin dashboard stats
- `POST /maintenance` - Toggle maintenance mode

### Upload (`/api/upload`)
- `POST /mod` - Upload mod files

### Payment (`/api/payment`)
- `POST /process` - Process mod payment
- `POST /unlock` - Unlock mod with code

## 🗄️ Database Models

### User Model
```typescript
{
  username: string
  email: string
  password: string (hashed)
  role: 'user' | 'admin'
  gamerTag: string
  favoriteGame: 'FS22' | 'FS25' | 'Both'
  purchasedMods: ObjectId[]
  unlockedMods: ObjectId[]
  favoriteMods: ObjectId[]
  downloadHistory: Object[]
  preferences: Object
  // ... more fields
}
```

### Mod Model
```typescript
{
  name: string
  slug: string
  description: string
  type: 'free' | 'paid' | 'unlock'
  price?: number
  unlockCode?: string
  version: string
  game: 'FS22' | 'FS25' | 'Both'
  category: string
  tags: string[]
  thumbnail: string
  screenshots: string[]
  files: Object[]
  downloads: number
  rating: number
  reviews: Object[]
  // ... more fields
}
```

## 🔐 Authentication

The backend uses JWT tokens for authentication:

1. **Register/Login**: Returns JWT token
2. **Protected Routes**: Include `Authorization: Bearer <token>` header
3. **Token Expiry**: 7 days by default
4. **Refresh**: Use `/api/auth/refresh` endpoint

## 🏃‍♂️ Development

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - Frontend URL for CORS
- `MAINTENANCE_MODE` - Enable/disable maintenance mode

## 🚦 API Response Format

All API responses follow this format:

```json
{
  "status": "success" | "error",
  "message": "Human readable message",
  "data": { ... },
  "code": "ERROR_CODE" // Only for errors
}
```

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request rate limiting
- **Input Validation**: Request data validation
- **Password Hashing**: bcrypt password hashing
- **NoSQL Injection Protection**: Mongoose sanitization

## 📊 Performance

- **MongoDB Indexing**: Optimized database queries
- **Redis Caching**: Fast data retrieval (optional)
- **Compression**: Response compression
- **Connection Pooling**: Efficient database connections

## 🐛 Error Handling

Comprehensive error handling with:
- Custom error classes
- Development vs production error responses
- Async error catching
- MongoDB error handling
- JWT error handling

## 🎮 Gaming Features

- **Three-Tier System**: Free, Paid, Unlock mods
- **Game Compatibility**: FS22, FS25, or Both
- **Categories**: Vehicles, Tools, Maps, etc.
- **User Profiles**: Gaming preferences and stats
- **Download Tracking**: User download history
- **Rating System**: Mod reviews and ratings

## 🚀 Deployment

Ready for deployment on:
- **Railway**: Easy Node.js deployment
- **Heroku**: Traditional PaaS
- **DigitalOcean**: VPS deployment
- **AWS/GCP**: Cloud deployment

## 📝 License

MIT License - Built for ModsBazaar Gaming Community

---

**ModsBazaar Backend v1.0.0** - Super fast and smooth! 🎮⚡
