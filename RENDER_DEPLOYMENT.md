# Deploy ModsBazaar Backend to Render

## Quick Setup Guide

### 1. Prepare Your Repository
Your backend is already configured with:
- ✅ `package.json` with proper scripts
- ✅ `render.yaml` configuration file (Node.js build)
- ✅ Health check endpoint at `/health`
- ✅ TypeScript build process
- ✅ Production-ready error handling
- ✅ Dockerfile temporarily renamed to prevent conflicts

### 2. Create a Render Account
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. This will automatically connect your repositories

### 3. Deploy Your Backend

#### Option A: Using render.yaml (Recommended)
1. Push your code to GitHub (including the new `render.yaml` file)
2. In Render dashboard, click "New +"
3. Select "Blueprint"
4. Choose your `ModsBazaar-API` repository
5. Render will automatically detect the `render.yaml` file
6. Click "Apply"

#### Option B: Manual Setup
1. In Render dashboard, click "New +"
2. Select "Web Service"
3. Choose your `ModsBazaar-API` repository
4. Configure:
   - **Name**: modsbazaar-backend
   - **Region**: Oregon (or your preferred region)
   - **Branch**: main
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (you can upgrade later)

### 4. Set Environment Variables
In your Render service dashboard, go to "Environment" and add:

#### Required Secrets (Add these in Render dashboard):
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - A secure random string (32+ characters)
- `REDIS_URL` - Your Redis connection string (optional)
- `EMAIL_HOST` - Your email service host
- `EMAIL_USER` - Your email username
- `EMAIL_PASS` - Your email password
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
- `DISCORD_WEBHOOK_URL` - Your Discord webhook URL (optional)
- `MASTER_API_KEY` - A secure API key for admin operations

#### Auto-configured Variables (already set in render.yaml):
- `NODE_ENV=production`
- `PORT=10000`
- `JWT_EXPIRES_IN=7d`
- `EMAIL_PORT=587`
- `FRONTEND_URL_PROD=https://modsbazaar.vercel.app`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=100`

### 5. Database Setup

#### MongoDB (Required)
You'll need a MongoDB database. Options:
- **MongoDB Atlas** (Free tier available): 
  1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
  2. Create a free cluster
  3. Get your connection string
  4. Add it as `MONGODB_URI` in Render

#### Redis (Optional - for caching)
Options for Redis:
- **Render Redis** (Paid): Create a Redis service in Render
- **Redis Cloud** (Free tier): Get connection string from Redis Cloud
- **Skip Redis**: Your app will work without it (caching disabled)

### 6. Your Backend URL
Once deployed, your backend will be available at:
```
https://modsbazaar-backend.onrender.com
```

Health check endpoint:
```
https://modsbazaar-backend.onrender.com/health
```

### 7. Update Frontend Configuration
Update your frontend environment variables to point to your Render backend:
```env
NEXT_PUBLIC_API_URL=https://modsbazaar-backend.onrender.com
```

### 8. Deployment Notes

#### Free Plan Limitations:
- Service may sleep after 15 minutes of inactivity
- 750 hours/month free usage
- Slower cold starts when service wakes up

#### Upgrade Options:
- **Starter ($7/month)**: No sleep, faster startup
- **Standard ($25/month)**: More resources, better performance
- **Pro ($85/month)**: High performance, priority support

#### Automatic Deployments:
- Render will automatically redeploy when you push to your main branch
- Build logs are available in the Render dashboard
- Health checks ensure your service is running properly

### 9. Monitoring
- Check service logs in Render dashboard
- Monitor health endpoint: `/health`
- Set up alerts for downtime (available on paid plans)

## Troubleshooting

### Common Issues:
1. **Build fails with "tsc: not found"**: 
   - This happens when Render uses Docker build instead of Node.js
   - Solution: Ensure Dockerfile is renamed to `Dockerfile.backup`
   - The render.yaml is configured for Node.js build (`env: node`)
2. **Service won't start**: Verify environment variables
3. **Database connection fails**: Check MongoDB URI format
4. **CORS errors**: Ensure frontend URL is correct in environment

### Support:
- Render has excellent documentation
- Free plan includes community support
- Paid plans include email support
