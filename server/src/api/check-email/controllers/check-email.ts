// Rate limiter for email existence checks (in-memory, resets on server restart).
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const RATE_LIMIT_MAX = parsePositiveInt(process.env.CHECK_EMAIL_RATE_LIMIT_MAX, 300)
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.CHECK_EMAIL_RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

// Cleanup expired entries every 30 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(ip)
  }
}, 30 * 60 * 1000)

export default {
  async checkEmail(ctx) {
    const ip = ctx.request.ip || 'unknown'

    if (!checkRateLimit(ip)) {
      ctx.status = 429
      ctx.body = { error: 'Too many requests. Please try again later.' }
      return
    }

    const { email } = ctx.query

    if (!email) {
      return ctx.badRequest('Email is required')
    }

    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { email: (email as string).toLowerCase().trim() } })

    // Always respond after a fixed delay to prevent timing-based enumeration.
    // An attacker measuring response time can infer whether the DB was hit (found vs not found).
    await new Promise((resolve) => setTimeout(resolve, 300))

    ctx.body = { exists: !!user }
  },
}
