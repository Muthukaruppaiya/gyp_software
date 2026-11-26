/**
 * Minimal in-memory fixed-window rate limiter (single server process).
 * Good enough to stop brute-forcing login passwords and onboarding codes.
 */
export function rateLimit({ windowMs, max, message, keyFn = (req) => req.ip }) {
  const hits = new Map();

  // Periodically drop expired windows so the map cannot grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: message || `Too many attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
      });
    }
    next();
  };
}
