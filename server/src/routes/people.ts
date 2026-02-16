import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSuggestedDuplicates, mergePeople } from '../services/dedup.js';

const createPersonSchema = z.object({
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  relationshipTag: z.string().optional(),
  notes: z.string().optional(),
});

const updatePersonSchema = createPersonSchema.partial();

const mergeSchema = z.object({
  person1Id: z.string(),
  person2Id: z.string(),
});

const peopleRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // List all people
  fastify.get('/', async (request) => {
    const people = await fastify.prisma.person.findMany({
      where: { userId: request.user.userId },
      include: {
        identities: true,
        celebrations: true,
        _count: { select: { addresses: true } },
      },
      orderBy: { displayName: 'asc' },
    });

    return people;
  });

  // Create person
  fastify.post('/', async (request, reply) => {
    const body = createPersonSchema.parse(request.body);

    const person = await fastify.prisma.person.create({
      data: {
        ...body,
        userId: request.user.userId,
      },
      include: { identities: true },
    });

    return reply.code(201).send(person);
  });

  // Get person by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const person = await fastify.prisma.person.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
      include: {
        identities: true,
        addresses: true,
        celebrations: true,
        eventGuests: {
          include: { event: true },
        },
      },
    });

    if (!person) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    return person;
  });

  // Update person
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updatePersonSchema.parse(request.body);

    // Verify person belongs to user
    const existing = await fastify.prisma.person.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    const person = await fastify.prisma.person.update({
      where: { id: request.params.id },
      data: body,
      include: {
        identities: true,
        addresses: true,
        celebrations: true,
      },
    });

    return person;
  });

  // Delete person
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify person belongs to user
    const existing = await fastify.prisma.person.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    await fastify.prisma.person.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Get suggested duplicates
  fastify.get('/duplicates', async (request) => {
    const suggestions = await getSuggestedDuplicates(fastify.prisma, request.user.userId);
    return suggestions;
  });

  // Merge two people
  fastify.post('/merge', async (request, reply) => {
    const body = mergeSchema.parse(request.body);

    try {
      const merged = await mergePeople(
        fastify.prisma,
        request.user.userId,
        body.person1Id,
        body.person2Id
      );
      return merged;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Merge failed',
      });
    }
  });

  // Search people
  fastify.get('/search', async (request) => {
    const query = z.object({ q: z.string().min(1) }).parse(request.query);

    const people = await fastify.prisma.person.findMany({
      where: {
        userId: request.user.userId,
        OR: [
          { displayName: { contains: query.q, mode: 'insensitive' } },
          { notes: { contains: query.q, mode: 'insensitive' } },
          { identities: { some: { username: { contains: query.q, mode: 'insensitive' } } } },
        ],
      },
      include: { identities: true },
      take: 20,
    });

    return people;
  });
};

export default peopleRoutes;
