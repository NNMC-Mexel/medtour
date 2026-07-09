/**
 * Simple in-memory rate limiter middleware for sensitive auth endpoints.
 * Applied to: /api/auth/local (login), /api/auth/local/register, /api/auth/forgot-password
 *
 * Limits: 10 requests per IP per 15-minute window.
 * Resets on server restart (acceptable for test; use Redis for production).
 */

type RateLimitRule = { max: number; windowMs: number }
type PrefixRateLimitRule = RateLimitRule & { prefix: string }

// Exact-path limits (highest priority).
const DEFAULT_LIMITS: Record<string, RateLimitRule> = {
  '/api/auth/local':            { max: 10, windowMs: 15 * 60 * 1000 },
  '/api/auth/local/register':   { max: 5,  windowMs: 60 * 60 * 1000 },
  '/api/auth/forgot-password':  { max: 5,  windowMs: 60 * 60 * 1000 },
}

// Prefix limits (matched when no exact rule applies). Keyed by prefix so all
// sub-paths share one bucket per IP.
//  - /api/upload: cap how fast a single client can push files into MinIO
//    (storage abuse; the upload-guard already enforces type/size).
//  - /api/file-proxy: blunt brute-force enumeration of file hashes.
const DEFAULT_PREFIX_LIMITS: PrefixRateLimitRule[] = [
  { prefix: '/api/upload',     max: 60,  windowMs: 15 * 60 * 1000 },
  { prefix: '/api/file-proxy', max: 300, windowMs: 60 * 1000 },
]

const store = new Map<string, { count: number; resetAt: number }>()

// Cleanup expired entries every 30 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 30 * 60 * 1000)

function getClientIp(ctx, trustProxy: boolean) {
  if (trustProxy) {
    const forwardedFor = ctx.get('x-forwarded-for')
    const firstForwardedIp = forwardedFor?.split(',')[0]?.trim()
    if (firstForwardedIp) return firstForwardedIp
  }

  return ctx.request.ip || ctx.ip || 'unknown'
}

export default (config = {}, { strapi }) => {
  const limits: Record<string, RateLimitRule> = {
    ...DEFAULT_LIMITS,
    ...((config as any).limits || {}),
  }
  const prefixLimits: PrefixRateLimitRule[] = (config as any).prefixLimits || DEFAULT_PREFIX_LIMITS
  const trustProxy = Boolean((config as any).trustProxy)

  return async (ctx, next) => {
    if (ctx.method === 'OPTIONS') return next()

    const path = ctx.request.path
    let limit = limits[path]
    let bucket = path

    if (!limit) {
      const prefixRule = prefixLimits.find((rule) => path.startsWith(rule.prefix))
      if (prefixRule) {
        limit = { max: prefixRule.max, windowMs: prefixRule.windowMs }
        bucket = prefixRule.prefix
      }
    }

    if (!limit) return next()

    const ip = getClientIp(ctx, trustProxy)
    const key = `${ip}:${bucket}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + limit.windowMs })
      return next()
    }

    if (entry.count >= limit.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      ctx.set('Retry-After', String(retryAfter))
      ctx.status = 429
      ctx.body = { error: { status: 429, name: 'TooManyRequests', message: 'Too many requests. Please try again later.' } }
      return
    }

    entry.count++
    return next()
  }
}
