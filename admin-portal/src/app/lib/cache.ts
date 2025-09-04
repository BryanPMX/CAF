// admin-portal/src/lib/cache.ts
// Frontend caching layer for improved performance

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class FrontendCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.cache.has(key) && !this.isExpired(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private isExpired(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  // Clean up expired entries
  cleanup(): void {
    for (const [key] of this.cache) {
      if (this.isExpired(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
export const frontendCache = new FrontendCache();

// Cleanup expired entries every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    frontendCache.cleanup();
  }, 60000);
}

// Cache keys for common data
export const CACHE_KEYS = {
  USERS: 'users',
  OFFICES: 'offices',
  CASES: 'cases',
  APPOINTMENTS: 'appointments',
  DASHBOARD_SUMMARY: 'dashboard_summary',
  USER_PROFILE: 'user_profile'
} as const;
