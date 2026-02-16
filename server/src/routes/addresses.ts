import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createAddressSchema = z.object({
  personId: z.string(),
  label: z.string().default('Home'),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
});

const updateAddressSchema = createAddressSchema.omit({ personId: true }).partial();

const addressesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Create address
  fastify.post('/', async (request, reply) => {
    const body = createAddressSchema.parse(request.body);

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

    const address = await fastify.prisma.address.create({
      data: body,
    });

    return reply.code(201).send(address);
  });

  // Update address
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updateAddressSchema.parse(request.body);

    // Verify address belongs to user's person
    const address = await fastify.prisma.address.findFirst({
      where: {
        id: request.params.id,
        person: { userId: request.user.userId },
      },
    });

    if (!address) {
      return reply.code(404).send({ error: 'Address not found' });
    }

    const updated = await fastify.prisma.address.update({
      where: { id: request.params.id },
      data: body,
    });

    return updated;
  });

  // Delete address
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify address belongs to user's person
    const address = await fastify.prisma.address.findFirst({
      where: {
        id: request.params.id,
        person: { userId: request.user.userId },
      },
    });

    if (!address) {
      return reply.code(404).send({ error: 'Address not found' });
    }

    await fastify.prisma.address.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Get addresses for a person
  fastify.get<{ Params: { personId: string } }>('/person/:personId', async (request, reply) => {
    // Verify person belongs to user
    const person = await fastify.prisma.person.findFirst({
      where: {
        id: request.params.personId,
        userId: request.user.userId,
      },
      include: { addresses: true },
    });

    if (!person) {
      return reply.code(404).send({ error: 'Person not found' });
    }

    return person.addresses;
  });
};

export default addressesRoutes;
