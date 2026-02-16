import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { normalizeEmail, normalizePhone, isValidEmail, isValidPhone } from '../utils/normalize.js';
import { generateVerificationCode } from '../utils/token.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  timezone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifyEmailSchema = z.object({
  code: z.string().length(6),
});

const sendPhoneCodeSchema = z.object({
  phone: z.string(),
});

const verifyPhoneSchema = z.object({
  code: z.string().length(6),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    // Check rate limit
    const allowed = await fastify.checkRegistrationRateLimit(request, reply);
    if (!allowed) return;

    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;
    const email = normalizeEmail(body.email);

    // Check if user exists
    const existing = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return reply.code(400).send({ error: 'Email already registered' });
    }

    // Validate phone if provided
    if (body.phone && !isValidPhone(body.phone)) {
      return reply.code(400).send({ error: 'Invalid phone number' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const emailVerifyCode = generateVerificationCode();

    const user = await fastify.prisma.user.create({
      data: {
        email,
        phone: body.phone ? normalizePhone(body.phone) : null,
        passwordHash,
        emailVerifyCode,
        timezone: body.timezone || 'America/New_York',
      },
    });

    // In production, send verification email here
    console.log(`[EMAIL] Verification code for ${email}: ${emailVerifyCode}`);

    const token = fastify.jwt.sign({ userId: user.id });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      token,
    });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    // Check rate limit
    const allowed = await fastify.checkLoginRateLimit(request, reply);
    if (!allowed) return;

    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;
    const email = normalizeEmail(body.email);

    const user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      fastify.recordFailedLogin(request);
      return reply.code(401).send({ error: 'Ongeldige inloggegevens' });
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) {
      fastify.recordFailedLogin(request);
      return reply.code(401).send({ error: 'Ongeldige inloggegevens' });
    }

    const token = fastify.jwt.sign({ userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        timezone: user.timezone,
      },
      token,
    };
  });

  // Verify email
  fastify.post('/verify-email', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = verifyEmailSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;
    const userId = request.user.userId;

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return reply.code(400).send({ error: 'Email already verified' });
    }

    if (user.emailVerifyCode !== body.code) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }

    await fastify.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifyCode: null },
    });

    return { success: true, message: 'Email verified' };
  });

  // Send phone verification code
  fastify.post('/send-phone-code', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = sendPhoneCodeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;
    const userId = request.user.userId;

    if (!isValidPhone(body.phone)) {
      return reply.code(400).send({ error: 'Invalid phone number' });
    }

    const normalizedPhone = normalizePhone(body.phone);
    const phoneVerifyCode = generateVerificationCode();

    await fastify.prisma.user.update({
      where: { id: userId },
      data: { phone: normalizedPhone, phoneVerifyCode },
    });

    // In production, send SMS here via Twilio
    console.log(`[SMS] Verification code for ${normalizedPhone}: ${phoneVerifyCode}`);

    return { success: true, message: 'Verification code sent' };
  });

  // Verify phone
  fastify.post('/verify-phone', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = verifyPhoneSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;
    const userId = request.user.userId;

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.phoneVerified) {
      return reply.code(400).send({ error: 'Phone already verified' });
    }

    if (user.phoneVerifyCode !== body.code) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }

    await fastify.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true, phoneVerifyCode: null },
    });

    return { success: true, message: 'Phone verified' };
  });

  // Get current user
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      timezone: user.timezone,
      pushEnabled: user.pushEnabled,
      emailDigestEnabled: user.emailDigestEnabled,
      digestDay: user.digestDay,
    };
  });

  // Update settings
  fastify.patch('/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const settingsSchema = z.object({
      timezone: z.string().optional(),
      pushEnabled: z.boolean().optional(),
      emailDigestEnabled: z.boolean().optional(),
      digestDay: z.number().min(0).max(6).optional(),
    });
    const result = settingsSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const body = result.data;

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: body,
    });

    return {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
      pushEnabled: user.pushEnabled,
      emailDigestEnabled: user.emailDigestEnabled,
      digestDay: user.digestDay,
    };
  });

  // Register push token
  fastify.post('/push-token', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const pushTokenSchema = z.object({
      token: z.string().min(1),
      platform: z.enum(['ios', 'android']),
    });

    const result = pushTokenSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validatiefout',
        details: result.error.errors,
      });
    }
    const { token, platform } = result.data;

    // Validate Expo push token format
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return reply.code(400).send({ error: 'Ongeldig push token formaat' });
    }

    await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: {
        pushToken: token,
        pushPlatform: platform,
        pushEnabled: true,
      },
    });

    return { success: true, message: 'Push token geregistreerd' };
  });

  // Remove push token (logout/disable)
  fastify.delete('/push-token', { preHandler: [fastify.authenticate] }, async (request) => {
    await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: {
        pushToken: null,
        pushPlatform: null,
      },
    });

    return { success: true, message: 'Push token verwijderd' };
  });
};

export default authRoutes;
