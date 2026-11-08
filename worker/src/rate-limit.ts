/** 内存令牌桶限流 —— Workers 单实例内存够用（个人使用场景） */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export function checkRateLimit(
  key: string,
  limitPerMinute: number,
): RateLimitResult {
  const now = Date.now();
  const refillPerMs = limitPerMinute / 60_000;
  const bucket = buckets.get(key) ?? { tokens: limitPerMinute, lastRefill: now };

  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(limitPerMinute, bucket.tokens + elapsed * refillPerMs);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const resetInSeconds = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    resetInSeconds: 0,
  };
}

export function clientKey(request: Request, cf?: { ip?: string }): string {
  const ip = cf?.ip ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
  return ip;
}
