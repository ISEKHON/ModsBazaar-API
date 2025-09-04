# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build (optional, saves space)
RUN npm prune --production

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
  const options = { hostname: '0.0.0.0', port: process.env.PORT || 8000, path: '/health', timeout: 2000 }; \
  const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); \
  req.on('error', () => process.exit(1)); \
  req.end();"

# Start the application
CMD ["npm", "start"]
