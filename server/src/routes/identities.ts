import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { normalizePhone, normalizeEmail, isValidPhone, isValidEmail } from '../utils/normalize.js';
import { findMatchingPerson } from '../services/dedup.js';

// Define SourceType enum locally
const SourceType = {
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  INSTAGRAM: 'INSTAGRAM',
  FACEBOOK: 'FACEBOOK',
  MANUAL: 'MANUAL',
} as const;
type SourceType = (typeof SourceType)[keyof typeof SourceType];

const createIdentitySchema = z.object({
  personId: z.string(),
  sourceType: z.enum(['PHONE', 'EMAIL', 'INSTAGRAM', 'FACEBOOK', 'MANUAL']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  sourceUserId: z.string().optional(),
});

const identitiesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Add identity to person
  fastify.post('/', async (request, reply) => {
    const body = createIdentitySchema.parse(request.body);

    // Verify person belongs to user
    const person = await fastify.prisma.person.findFirst({
      where: {
        id: body.personId,
        userId: request.user.userId,
      },
    });

    if (!person) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    // Validate and normalize phone/email
    let normalizedPhone: string | null = null;
    let normalizedEmail: string | null = null;

    if (body.phone) {
      if (!isValidPhone(body.phone)) {
        return reply.code(400).send({ error: 'Invalid phone number' });
      }
      normalizedPhone = normalizePhone(body.phone);
    }

    if (body.email) {
      if (!isValidEmail(body.email)) {
        return reply.code(400).send({ error: 'Invalid email address' });
      }
      normalizedEmail = normalizeEmail(body.email);
    }

    // Check for existing person with matching identity (for auto-linking notification)
    const matchingPerson = await findMatchingPerson(
      fastify.prisma,
      request.user.userId,
      body.phone,
      body.email
    );

    // Create the identity
    const identity = await fastify.prisma.identity.create({
      data: {
        personId: body.personId,
        sourceType: body.sourceType,
        sourceUserId: body.sourceUserId,
        normalizedPhone,
        normalizedEmail,
        username: body.username,
      },
    });

    // If there's a match with a different person, flag it for the user
    const hasPotentialDuplicate = matchingPerson && matchingPerson.id !== body.personId;

    return reply.code(201).send({
      identity,
      potentialDuplicate: hasPotentialDuplicate
        ? {
            personId: matchingPerson.id,
            displayName: matchingPerson.displayName,
            matchType: normalizedPhone ? 'phone' : 'email',
          }
        : null,
    });
  });

  // Delete identity
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify identity belongs to user's person
    const identity = await fastify.prisma.identity.findFirst({
      where: {
        id: request.params.id,
        person: { userId: request.user.userId },
      },
    });

    if (!identity) {
      return reply.code(404).send({ error: 'Identity not found' });
    }

    await fastify.prisma.identity.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Get identities for a person
  fastify.get<{ Params: { personId: string } }>('/person/:personId', async (request, reply) => {
    // Verify person belongs to user
    const person = await fastify.prisma.person.findFirst({
      where: {
        id: request.params.personId,
        userId: request.user.userId,
      },
      include: { identities: true },
    });

    if (!person) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    return person.identities;
  });
};

export default identitiesRoutes;
