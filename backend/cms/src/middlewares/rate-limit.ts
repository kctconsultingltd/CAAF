import type { Core } from '@strapi/strapi';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 10;
const RATE_LIMITED_PATHS = ['/api/deal-submissions', '/api/investor-interests'];

const store = new Map<string, { count: number; reset: number }>();

export default (_config: unknown, _ctx: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const isLimitedPath = ctx.method === 'POST' &&
      RATE_LIMITED_PATHS.some(p => ctx.path.startsWith(p));

    if (isLimitedPath) {
      const ip: string = ctx.request.ip ?? 'unknown';
      const key = `${ip}:${ctx.path}`;
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.reset) {
        store.set(key, { count: 1, reset: now + WINDOW_MS });
      } else {
        entry.count += 1;
        if (entry.count > MAX_REQUESTS) {
          ctx.status = 429;
          ctx.body = { error: { status: 429, name: 'RateLimitError', message: 'Too many requests. Please try again later.' } };
          return;
        }
      }

      // Probabilistic cleanup of expired entries (~1% chance per request)
      if (Math.random() < 0.01) {
        for (const [k, v] of store.entries()) {
          if (now > v.reset) store.delete(k);
        }
      }
    }

    await next();
  };
};
