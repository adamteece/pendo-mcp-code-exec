/**
 * RateLimiter implements a sliding window rate limiting algorithm
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limit: number;
  private window: number; // milliseconds

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }

  /**
   * Check if a request is allowed for the given key
   * @returns true if allowed, false if rate limit exceeded
   */
  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < this.window);

    if (validTimestamps.length >= this.limit) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  async getRemaining(key: string): Promise<number> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((ts) => now - ts < this.window);

    return Math.max(0, this.limit - validTimestamps.length);
  }

  /**
   * Get time until reset for a key
   */
  async getResetTime(key: string): Promise<number> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((ts) => now - ts < this.window);

    if (validTimestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...validTimestamps);
    const resetTime = oldestTimestamp + this.window;

    return Math.max(0, resetTime - now);
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

/**
 * Global rate limiter for Pendo API calls (100 requests per minute)
 */
export const pendoRateLimiter = new RateLimiter(100, 60000);
