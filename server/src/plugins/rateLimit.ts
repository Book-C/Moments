import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';

// In-memory store for IP-based rate limiting (no auth required)
const ipRateLimits: Map<string, { count: number; windowStart: number; lockedUntil?: number }> = new Map();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of ipRateLimits) {
    // Remove entries older than 2 hours
    if (now - value.windowStart > 2 * 60 * 60 * 1000) {
      ipRateLimits.delete(key);
    }
  }
}, 10 * 60 * 1000);

function getClientIP(request: FastifyRequest): string {
  // Check for forwarded headers (when behind proxy)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return request.ip || 'unknown';
}

function getHourWindow(): number {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.getTime();
}

declare module 'fastify' {
  interface FastifyInstance {
    checkInviteRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    checkLoginRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
    checkRegistrationRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
    recordFailedLogin: (request: FastifyRequest) => void;
  }
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  // IP-based rate limiting for login attempts
  fastify.decorate('checkLoginRateLimit', async function (request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const ip = getClientIP(request);
    const key = `login:${ip}`;
    const windowStart = getHourWindow();
    const now = Date.now();

    const entry = ipRateLimits.get(key);

    // Check if IP is locked out
    if (entry?.lockedUntil && now < entry.lockedUntil) {
      const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
      reply.code(429).send({
        error: 'Te veel inlogpogingen',
        message: `Probeer opnieuw over ${Math.ceil(retryAfter / 60)} minuten`,
        retryAfter,
      });
      return false;
    }

    // Check if in current window and exceeded limit
    if (entry && entry.windowStart === windowStart && entry.count >= config.rateLimit.loginAttemptsPerHour) {
      // Lock out for configured duration
      entry.lockedUntil = now + config.rateLimit.loginLockoutMinutes * 60 * 1000;
      reply.code(429).send({
        error: 'Te veel inlogpogingen',
        message: `Probeer opnieuw over ${config.rateLimit.loginLockoutMinutes} minuten`,
        retryAfter: config.rateLimit.loginLockoutMinutes * 60,
      });
      return false;
    }

    return true;
  });

  // Record a failed login attempt
  fastify.decorate('recordFailedLogin', function (request: FastifyRequest): void {
    const ip = getClientIP(request);
    const key = `login:${ip}`;
    const windowStart = getHourWindow();

    const entry = ipRateLimits.get(key);
    if (entry && entry.windowStart === windowStart) {
      entry.count++;
    } else {
      ipRateLimits.set(key, { count: 1, windowStart });
    }
  });

  // IP-based rate limiting for registration attempts
  fastify.decorate('checkRegistrationRateLimit', async function (request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const ip = getClientIP(request);
    const key = `register:${ip}`;
    const windowStart = getHourWindow();

    const entry = ipRateLimits.get(key);

    // Check if in current window and exceeded limit
    if (entry && entry.windowStart === windowStart && entry.count >= config.rateLimit.registrationsPerHour) {
      reply.code(429).send({
        error: 'Te veel registraties',
        message: `Maximum ${config.rateLimit.registrationsPerHour} registraties per uur bereikt`,
        retryAfter: 60 - new Date().getMinutes(),
      });
      return false;
    }

    // Increment counter
    if (entry && entry.windowStart === windowStart) {
      entry.count++;
    } else {
      ipRateLimits.set(key, { count: 1, windowStart });
    }

    return true;
  });

  // User-based rate limiting for invite actions (requires auth)
  fastify.decorate('checkInviteRateLimit', async function (request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0); // Start of current hour

    // Get or create rate limit log
    const log = await fastify.prisma.rateLimitLog.findUnique({
      where: {
        userId_action_windowStart: {
          userId,
          action: 'invite',
          windowStart,
        },
      },
    });

    if (log && log.count >= config.rateLimit.invitesPerHour) {
      reply.code(429).send({
        error: 'Rate limit exceeded',
        message: `You can only send ${config.rateLimit.invitesPerHour} invites per hour`,
        retryAfter: 60 - new Date().getMinutes(), // Minutes until next hour
      });
      return;
    }

    // Increment or create the log
    await fastify.prisma.rateLimitLog.upsert({
      where: {
        userId_action_windowStart: {
          userId,
          action: 'invite',
          windowStart,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        userId,
        action: 'invite',
        windowStart,
        count: 1,
      },
    });
  });
};

export default fp(rateLimitPlugin, { name: 'rateLimit', dependencies: ['prisma', 'auth'] });
