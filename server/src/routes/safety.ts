import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { normalizePhone, normalizeEmail } from '../utils/normalize.js';

const blockSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  reason: z.string().optional(),
});

const reportSchema = z.object({
  eventId: z.string().optional(),
  reason: z.string().min(1),
});

const safetyRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Block a contact
  fastify.post('/block', async (request, reply) => {
    const body = blockSchema.parse(request.body);

    if (!body.phone && !body.email) {
      return reply.code(400).send({ error: 'Phone or email required' });
    }

    const normalizedPhone = body.phone ? normalizePhone(body.phone) : null;
    const normalizedEmail = body.email ? normalizeEmail(body.email) : null;

    // Check if already blocked
    const existing = await fastify.prisma.blockedContact.findFirst({
      where: {
        userId: request.user.userId,
        OR: [
          normalizedPhone ? { blockedPhone: normalizedPhone } : {},
          normalizedEmail ? { blockedEmail: normalizedEmail } : {},
        ].filter((o) => Object.keys(o).length > 0),
      },
    });

    if (existing) {
      return reply.code(400).send({ error: 'Contact already blocked' });
    }

    const blocked = await fastify.prisma.blockedContact.create({
      data: {
        userId: request.user.userId,
        blockedPhone: normalizedPhone,
        blockedEmail: normalizedEmail,
        reason: body.reason,
      },
    });

    return reply.code(201).send(blocked);
  });

  // Unblock a contact
  fastify.delete<{ Params: { id: string } }>('/block/:id', async (request, reply) => {
    const blocked = await fastify.prisma.blockedContact.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!blocked) {
      return reply.code(404).send({ error: 'Blocked contact not found' });
    }

    await fastify.prisma.blockedContact.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // List blocked contacts
  fastify.get('/blocked', async (request) => {
    const blocked = await fastify.prisma.blockedContact.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return blocked;
  });

  // Report an event or abuse
  fastify.post('/report', async (request, reply) => {
    const body = reportSchema.parse(request.body);

    // If reporting an event, verify it exists
    if (body.eventId) {
      const event = await fastify.prisma.event.findUnique({
        where: { id: body.eventId },
      });

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      // Don't allow reporting own events
      if (event.hostUserId === request.user.userId) {
        return reply.code(400).send({ error: 'Cannot report your own event' });
      }
    }

    const report = await fastify.prisma.report.create({
      data: {
        reporterUserId: request.user.userId,
        reportedEventId: body.eventId,
        reason: body.reason,
      },
    });

    // In production, this would trigger admin review
    console.log(`[REPORT] User ${request.user.userId} reported: ${body.reason}`);
    if (body.eventId) {
      console.log(`[REPORT] Reported event: ${body.eventId}`);
    }

    return reply.code(201).send({
      id: report.id,
      message: 'Report submitted successfully',
    });
  });
};

export default safetyRoutes;
