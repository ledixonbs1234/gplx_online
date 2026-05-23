/**
 * Cache đơn giản với TTL (Time To Live) cho dữ liệu Google Sheets
 * Lưu trữ trong memory để tăng tốc độ tìm kiếm
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Thời gian sống tính bằng milliseconds
}

export class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLMinutes: number = 5) {
    this.defaultTTL = defaultTTLMinutes * 60 * 1000; // Chuyển đổi sang milliseconds
  }

  /**
   * Lấy dữ liệu từ cache
   * @param key Khóa của cache
   * @returns Dữ liệu nếu còn hạn, null nếu hết hạn hoặc không tồn tại
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Kiểm tra xem cache có hết hạn chưa
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Xóa entry đã hết hạn
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Lưu dữ liệu vào cache
   * @param key Khóa của cache
   * @param data Dữ liệu cần lưu
   * @param ttlMinutes Thời gian sống tùy chọn (phút). Nếu không cung cấp sẽ dùng default
   */
  set<T>(key: string, data: T, ttlMinutes?: number): void {
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Xóa một entry khỏi cache
   * @param key Khóa cần xóa
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Xóa toàn bộ cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Kiểm tra xem key có tồn tại trong cache và còn hạn không
   * @param key Khóa cần kiểm tra
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Lấy thông tin về cache (cho mục đích debug)
   */
  getInfo(): { size: number; keys: string[] } {
    const now = Date.now();
    const validKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp <= entry.ttl) {
        validKeys.push(key);
      } else {
        // Xóa entry đã hết hạn
        this.cache.delete(key);
      }
    }
    
    return {
      size: validKeys.length,
      keys: validKeys,
    };
  }

  /**
   * Dọn dẹp các entry đã hết hạn
   */
  cleanup(): number {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}

// Singleton instance với TTL mặc định là 5 phút
export const sheetsCache = new SimpleCache(5);

/**
 * Hook để dọn dẹp cache định kỳ (mỗi 10 phút)
 * Chỉ gọi trong server-side code hoặc API routes
 */
export function startCacheCleanup(intervalMinutes: number = 10) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  const intervalId = setInterval(() => {
    const deletedCount = sheetsCache.cleanup();
    if (deletedCount > 0) {
      console.log(`🧹 Đã dọn dẹp ${deletedCount} entries khỏi cache`);
    }
  }, intervalMs);

  // Cleanup khi process kết thúc
  process.on('exit', () => {
    clearInterval(intervalId);
  });

  return intervalId;
}
