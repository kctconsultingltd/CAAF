import ratelimit from 'koa-ratelimit';

const db = new Map();

const THROTTLED_PATHS = ['/api/deal-submissions', '/api/investor-interests'];

export default (_config: unknown, _ctx: unknown) => {
  const limiter = ratelimit({
    driver: 'memory',
    db,
    duration: 15 * 60 * 1000, // 15 minutes
    max: 10,
    errorMessage: JSON.stringify({
      data: null,
      error: { status: 429, name: 'TooManyRequests', message: 'Too many requests. Please try again later.' },
    }),
    id: (ctx) => ctx.ip,
    whitelist: (ctx) => !THROTTLED_PATHS.some((p) => ctx.path.startsWith(p)),
  });
  return limiter;
};
