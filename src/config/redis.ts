import { createClient, RedisClientType } from 'redis';

// Redis client instance
let redisClient: RedisClientType | null = null;

export const initRedis = async (): Promise<boolean> => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) return false; // Stop retrying after 3 attempts
          return Math.min(retries * 50, 500);
        }
      },
    });

    // Event listeners
    redisClient.on('connect', () => {
      console.log('🔴 Redis connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready for commands');
    });

    redisClient.on('error', (err) => {
      if (err.message && err.message.trim()) {
        console.warn('⚠️ Redis connection issue:', err.message);
      }
      // Suppress empty error messages to keep logs clean
    });

    redisClient.on('end', () => {
      console.log('⚠️ Redis connection ended');
    });

    // Connect to Redis with timeout
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    
    // Test connection
    await redisClient.ping();
    console.log('🏓 Redis ping successful');
    return true;

  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown connection error';
    console.warn('⚠️ Redis not available - continuing without cache. Reason:', errorMessage);
    redisClient = null; // Set to null so we know it's not available
    // Don't exit process, app can work without Redis (but slower)
    return false;
  }
};

// Cache management utilities
export class CacheManager {
  // Get cached data
  static async get(key: string): Promise<any> {
    try {
      if (!redisClient?.isReady) return null;
      
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      // Silently fail - cache is optional
      return null;
    }
  }

  // Set cached data with expiration
  static async set(key: string, data: any, expireInSeconds: number = 3600): Promise<boolean> {
    try {
      if (!redisClient?.isReady) return false;
      
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      // Silently fail - cache is optional
      return false;
    }
  }

  // Delete cached data
  static async del(key: string): Promise<boolean> {
    try {
      if (!redisClient?.isReady) return false;
      
      await redisClient.del(key);
      return true;
    } catch (error) {
      // Silently fail - cache is optional
      return false;
    }
  }

  // Clear all cache with pattern
  static async clearPattern(pattern: string): Promise<boolean> {
    try {
      if (!redisClient?.isReady) return false;
      
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      // Silently fail - cache is optional
      return false;
    }
  }

  // Get cache statistics
  static async getStats(): Promise<any> {
    try {
      if (!redisClient?.isReady) return { connected: false, message: 'Redis not available' };
      
      const info = await redisClient.info('memory');
      return {
        connected: redisClient.isReady,
        memory: info,
        uptime: await redisClient.info('server')
      };
    } catch (error) {
      return { connected: false, error: (error as Error).message };
    }
  }
}

// Predefined cache keys for ModsBazaar
export const CACHE_KEYS = {
  // Mods
  MODS_LIST: 'mods:list',
  MODS_FEATURED: 'mods:featured',
  MODS_POPULAR: 'mods:popular',
  MODS_RECENT: 'mods:recent',
  MOD_DETAIL: (id: string) => `mod:${id}`,
  MOD_DOWNLOAD_COUNT: (id: string) => `mod:${id}:downloads`,
  
  // Users
  USER_PROFILE: (id: string) => `user:${id}:profile`,
  USER_PURCHASES: (id: string) => `user:${id}:purchases`,
  USER_DOWNLOADS: (id: string) => `user:${id}:downloads`,
  
  // Analytics
  ANALYTICS_DASHBOARD: 'analytics:dashboard',
  ANALYTICS_MODS: 'analytics:mods',
  ANALYTICS_USERS: 'analytics:users',
  
  // Search
  SEARCH_RESULTS: (query: string) => `search:${encodeURIComponent(query)}`,
  
  // System
  SYSTEM_STATS: 'system:stats',
  MAINTENANCE_MODE: 'system:maintenance'
};

// Cache expiration times (in seconds)
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes  
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
};

export { redisClient };
