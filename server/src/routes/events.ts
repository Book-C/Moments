import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GuestStatus } from '@prisma/client';
import { generateInviteToken, getInviteExpiry } from '../utils/token.js';
import { normalizePhone, normalizeEmail } from '../utils/normalize.js';
import { scheduleEventReminders } from '../services/notifications.js';
import { config } from '../config.js';

const createEventSchema = z.object({
  title: z.string().min(1),
  datetime: z.string().transform((s) => new Date(s)),
  location: z.string().optional(),
  description: z.string().optional(),
  inviteExpiryDays: z.number().default(7),
});

const updateEventSchema = createEventSchema.partial();

const inviteGuestSchema = z.object({
  personId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // List user's events
  fastify.get('/', async (request) => {
    const events = await fastify.prisma.event.findMany({
      where: { hostUserId: request.user.userId },
      include: {
        _count: { select: { guests: true } },
      },
      orderBy: { datetime: 'asc' },
    });

    return events.map((e) => ({
      ...e,
      inviteLink: `${config.webRsvpUrl}/rsvp/${e.inviteToken}`,
    }));
  });

  // Create event
  fastify.post('/', async (request, reply) => {
    const body = createEventSchema.parse(request.body);

    const event = await fastify.prisma.event.create({
      data: {
        hostUserId: request.user.userId,
        title: body.title,
        datetime: body.datetime,
        location: body.location,
        description: body.description,
        inviteToken: generateInviteToken(),
        inviteExpiresAt: getInviteExpiry(body.inviteExpiryDays),
      },
    });

    // Schedule reminders for the host
    await scheduleEventReminders(fastify.prisma, request.user.userId, event.id, event.datetime);

    return reply.code(201).send({
      ...event,
      inviteLink: `${config.webRsvpUrl}/rsvp/${event.inviteToken}`,
    });
  });

  // Get event by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const event = await fastify.prisma.event.findFirst({
      where: {
        id: request.params.id,
        hostUserId: request.user.userId,
      },
      include: {
        guests: {
          include: { person: true },
        },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    return {
      ...event,
      inviteLink: `${config.webRsvpUrl}/rsvp/${event.inviteToken}`,
    };
  });

  // Update event
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updateEventSchema.parse(request.body);

    // Verify event belongs to user
    const existing = await fastify.prisma.event.findFirst({
      where: {
        id: request.params.id,
        hostUserId: request.user.userId,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    const event = await fastify.prisma.event.update({
      where: { id: request.params.id },
      data: body,
    });

    // Reschedule reminders if datetime changed
    if (body.datetime) {
      await scheduleEventReminders(fastify.prisma, request.user.userId, event.id, event.datetime);
    }

    return {
      ...event,
      inviteLink: `${config.webRsvpUrl}/rsvp/${event.inviteToken}`,
    };
  });

  // Delete event
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify event belongs to user
    const existing = await fastify.prisma.event.findFirst({
      where: {
        id: request.params.id,
        hostUserId: request.user.userId,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    await fastify.prisma.event.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Invite guest (with rate limiting)
  fastify.post<{ Params: { id: string } }>(
    '/:id/invite',
    { preHandler: [fastify.checkInviteRateLimit] },
    async (request, reply) => {
      const body = inviteGuestSchema.parse(request.body);

      // Verify event belongs to user
      const event = await fastify.prisma.event.findFirst({
        where: {
          id: request.params.id,
          hostUserId: request.user.userId,
        },
      });

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      // If inviting by personId, verify person belongs to user
      if (body.personId) {
        const person = await fastify.prisma.person.findFirst({
          where: {
            id: body.personId,
            userId: request.user.userId,
          },
        });

        if (!person) {
          return reply.code(404).send({ error: 'Person not found' });
        }
      }

      // Check if guest already invited
      const existingGuest = await fastify.prisma.eventGuest.findFirst({
        where: {
          eventId: event.id,
          OR: [
            body.personId ? { personId: body.personId } : {},
            body.email ? { invitedEmail: normalizeEmail(body.email) } : {},
            body.phone ? { invitedPhone: normalizePhone(body.phone) } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });

      if (existingGuest) {
        return reply.code(400).send({ error: 'Guest already invited' });
      }

      // Check if contact is blocked
      if (body.email || body.phone) {
        const blocked = await fastify.prisma.blockedContact.findFirst({
          where: {
            userId: request.user.userId,
            OR: [
              body.email ? { blockedEmail: normalizeEmail(body.email) } : {},
              body.phone ? { blockedPhone: normalizePhone(body.phone) } : {},
            ].filter((o) => Object.keys(o).length > 0),
          },
        });

        if (blocked) {
          return reply.code(400).send({ error: 'This contact is blocked' });
        }
      }

      const guest = await fastify.prisma.eventGuest.create({
        data: {
          eventId: event.id,
          personId: body.personId,
          invitedEmail: body.email ? normalizeEmail(body.email) : null,
          invitedPhone: body.phone ? normalizePhone(body.phone) : null,
          status: GuestStatus.PENDING,
        },
        include: { person: true },
      });

      // In production, send invite email/SMS here
      if (body.email) {
        console.log(
          `[EMAIL] Invite sent to ${body.email} for event "${event.title}": ${config.webRsvpUrl}/rsvp/${event.inviteToken}`
        );
      }
      if (body.phone) {
        console.log(
          `[SMS] Invite sent to ${body.phone} for event "${event.title}": ${config.webRsvpUrl}/rsvp/${event.inviteToken}`
        );
      }

      return reply.code(201).send(guest);
    }
  );

  // Get guests for event
  fastify.get<{ Params: { id: string } }>('/:id/guests', async (request, reply) => {
    // Verify event belongs to user
    const event = await fastify.prisma.event.findFirst({
      where: {
        id: request.params.id,
        hostUserId: request.user.userId,
      },
      include: {
        guests: {
          include: { person: true },
        },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    // Group guests by status
    const grouped = {
      accepted: event.guests.filter((g) => g.status === GuestStatus.ACCEPTED),
      declined: event.guests.filter((g) => g.status === GuestStatus.DECLINED),
      maybe: event.guests.filter((g) => g.status === GuestStatus.MAYBE),
      pending: event.guests.filter((g) => g.status === GuestStatus.PENDING),
    };

    return grouped;
  });

  // Regenerate invite token
  fastify.post<{ Params: { id: string } }>('/:id/regenerate-token', async (request, reply) => {
    // Verify event belongs to user
    const existing = await fastify.prisma.event.findFirst({
      where: {
        id: request.params.id,
        hostUserId: request.user.userId,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    const event = await fastify.prisma.event.update({
      where: { id: request.params.id },
      data: {
        inviteToken: generateInviteToken(),
        inviteExpiresAt: getInviteExpiry(),
      },
    });

    return {
      ...event,
      inviteLink: `${config.webRsvpUrl}/rsvp/${event.inviteToken}`,
    };
  });
};

export default eventsRoutes;
