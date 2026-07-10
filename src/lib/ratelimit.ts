// rate limit פר-IP על יצירת ערכים (PLAN 1.1).
// ממשק אחד, שני מימושים: in-memory (dev/בדיקות) ו-Upstash (production, מזוהה לפי env).
// המכסה היומית הגלובלית נשארת קו הגנה שני — כאן מונעים ממשתמש אחד לרוקן אותה.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const CREATES_PER_HOUR = Number(process.env.RATE_LIMIT_CREATES_PER_HOUR ?? "3");
const REPORTS_PER_HOUR = Number(process.env.RATE_LIMIT_REPORTS_PER_HOUR ?? "10");
const WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface RateLimiter {
  limit(ip: string): Promise<RateLimitResult>;
}

// --- מימוש in-memory: חלון הזזה פשוט. מספיק ל-dev ולשרת יחיד. ---
class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number) {}

  async limit(ip: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const recent = (this.hits.get(ip) ?? []).filter((t) => t > windowStart);
    if (recent.length >= this.max) {
      const oldest = Math.min(...recent);
      this.hits.set(ip, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000),
      };
    }
    recent.push(now);
    this.hits.set(ip, recent);
    // ניקוי עצלן — מונע גדילה אינסופית של המפה.
    if (this.hits.size > 10_000) {
      for (const [key, times] of this.hits) {
        if (times.every((t) => t <= windowStart)) this.hits.delete(key);
      }
    }
    return { allowed: true };
  }
}

// --- מימוש Upstash: חלון הזזה מבוזר — שורד ריבוי instances ו-cold starts. ---
class UpstashRateLimiter implements RateLimiter {
  private limiter: Ratelimit;
  constructor(max: number, prefix: string) {
    this.limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(max, "1 h"),
      prefix: `perspectipedia:${prefix}`,
    });
  }

  async limit(ip: string): Promise<RateLimitResult> {
    const res = await this.limiter.limit(ip);
    return {
      allowed: res.success,
      retryAfterSeconds: res.success
        ? undefined
        : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }
}

function createLimiter(max: number, prefix: string): RateLimiter {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRateLimiter(max, prefix);
  }
  return new MemoryRateLimiter(max);
}

// singletons ברמת המודול — חלון אחד לכל התהליך, נפרד לכל שימוש.
const createLimiterInstance = createLimiter(CREATES_PER_HOUR, "create");
const reportLimiterInstance = createLimiter(REPORTS_PER_HOUR, "report");

export function limitCreate(ip: string): Promise<RateLimitResult> {
  if (CREATES_PER_HOUR <= 0) return Promise.resolve({ allowed: true }); // 0 = כבוי
  return createLimiterInstance.limit(ip);
}

export function limitReport(ip: string): Promise<RateLimitResult> {
  if (REPORTS_PER_HOUR <= 0) return Promise.resolve({ allowed: true }); // 0 = כבוי
  return reportLimiterInstance.limit(ip);
}
