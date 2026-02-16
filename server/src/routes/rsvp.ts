import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GuestStatus } from '@prisma/client';
import { normalizePhone, normalizeEmail } from '../utils/normalize.js';

const rsvpSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'MAYBE']),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

/**
 * Public RSVP routes - no authentication required
 */
const rsvpRoutes: FastifyPluginAsync = async (fastify) => {
  // Get event details by invite token (public)
  fastify.get<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const event = await fastify.prisma.event.findUnique({
      where: { inviteToken: request.params.token },
      include: {
        host: {
          select: { email: true }, // Only expose minimal host info
        },
      },
    });

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    // Check if invite has expired
    if (event.inviteExpiresAt < new Date()) {
      return reply.code(410).send({
        error: 'Invite expired',
        message: 'This invite link has expired. Please request a new one from the host.',
      });
    }

    // Return limited public event info
    return {
      id: event.id,
      title: event.title,
      datetime: event.datetime,
      location: event.location,
      description: event.description,
      hostEmail: event.host.email,
    };
  });

  // Submit RSVP (public)
  fastify.post<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const body = rsvpSchema.parse(request.body);

    const event = await fastify.prisma.event.findUnique({
      where: { inviteToken: request.params.token },
    });

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    // Check if invite has expired
    if (event.inviteExpiresAt < new Date()) {
      return reply.code(410).send({
        error: 'Invite expired',
        message: 'This invite link has expired. Please request a new one from the host.',
      });
    }

    const normalizedEmail = body.email ? normalizeEmail(body.email) : null;
    const normalizedPhone = body.phone ? normalizePhone(body.phone) : null;

    // Check if this person already RSVPed
    let existingGuest = null;

    if (normalizedEmail || normalizedPhone) {
      existingGuest = await fastify.prisma.eventGuest.findFirst({
        where: {
          eventId: event.id,
          OR: [
            normalizedEmail ? { invitedEmail: normalizedEmail } : {},
            normalizedPhone ? { invitedPhone: normalizedPhone } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });
    }

    if (existingGuest) {
      // Update existing RSVP
      const guest = await fastify.prisma.eventGuest.update({
        where: { id: existingGuest.id },
        data: {
          status: body.status as GuestStatus,
          guestName: body.name || existingGuest.guestName,
          respondedAt: new Date(),
        },
      });

      return {
        message: 'RSVP updated',
        status: guest.status,
      };
    }

    // Create new RSVP
    const guest = await fastify.prisma.eventGuest.create({
      data: {
        eventId: event.id,
        status: body.status as GuestStatus,
        guestName: body.name,
        invitedEmail: normalizedEmail,
        invitedPhone: normalizedPhone,
        respondedAt: new Date(),
      },
    });

    return {
      message: 'RSVP submitted',
      status: guest.status,
    };
  });

  // Get current RSVP status (public, by email/phone)
  fastify.get<{ Params: { token: string }; Querystring: { email?: string; phone?: string } }>(
    '/:token/status',
    async (request, reply) => {
      const { email, phone } = request.query;

      if (!email && !phone) {
        return reply.code(400).send({ error: 'Email or phone required' });
      }

      const event = await fastify.prisma.event.findUnique({
        where: { inviteToken: request.params.token },
      });

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      const normalizedEmail = email ? normalizeEmail(email) : null;
      const normalizedPhone = phone ? normalizePhone(phone) : null;

      const guest = await fastify.prisma.eventGuest.findFirst({
        where: {
          eventId: event.id,
          OR: [
            normalizedEmail ? { invitedEmail: normalizedEmail } : {},
            normalizedPhone ? { invitedPhone: normalizedPhone } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });

      if (!guest) {
        return { status: null, message: 'No RSVP found' };
      }

      return {
        status: guest.status,
        guestName: guest.guestName,
        respondedAt: guest.respondedAt,
      };
    }
  );
};

export default rsvpRoutes;
