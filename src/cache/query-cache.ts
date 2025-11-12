import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * QueryCache provides a file-based caching system for Pendo API responses
 */
export class QueryCache {
  private cacheDir: string;
  private ttl: number; // Time to live in milliseconds

  constructor(cacheDir = './cache', ttl = 3600000) {
    // Default 1 hour TTL
    this.cacheDir = cacheDir;
    this.ttl = ttl;
  }

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.hashKey(key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      const stats = await fs.stat(cachePath);
      const age = Date.now() - stats.mtimeMs;

      // Check if cache is expired
      if (age > this.ttl) {
        await fs.unlink(cachePath);
        return null;
      }

      const content = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Set cached value by key
   */
  async set(key: string, value: any): Promise<void> {
    const cacheKey = this.hashKey(key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(value));
  }

  /**
   * Clear specific cache entry
   */
  async clear(key: string): Promise<void> {
    const cacheKey = this.hashKey(key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      await fs.unlink(cachePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        totalSize += stats.size;

        if (oldestEntry === null || stats.mtimeMs < oldestEntry) {
          oldestEntry = stats.mtimeMs;
        }

        if (newestEntry === null || stats.mtimeMs > newestEntry) {
          newestEntry = stats.mtimeMs;
        }
      }

      return {
        totalEntries: jsonFiles.length,
        totalSize,
        oldestEntry,
        newestEntry,
      };
    } catch {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Hash cache key for filename
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create cache key from function name and parameters
   */
  static createKey(functionName: string, params: any): string {
    return `${functionName}:${JSON.stringify(params)}`;
  }
}

/**
 * Decorator to add caching to async functions
 */
export function cached(ttl?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new QueryCache('./cache', ttl);

    descriptor.value = async function (...args: any[]) {
      const cacheKey = QueryCache.createKey(propertyKey, args);

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await cache.set(cacheKey, result);

      return result;
    };

    return descriptor;
  };
}

/**
 * Global cache instance
 */
export const globalCache = new QueryCache();
