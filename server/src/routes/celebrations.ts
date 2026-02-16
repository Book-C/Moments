import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CelebrationType } from '@prisma/client';
import { scheduleCelebrationReminders } from '../services/notifications.js';

const createCelebrationSchema = z.object({
  personId: z.string(),
  type: z.nativeEnum(CelebrationType),
  title: z.string().optional(), // Required for LIFE_EVENT
  date: z.string().transform((s) => new Date(s)),
  recurringRule: z.string().optional(), // RRULE format
  reminderOffsets: z.array(z.number()).default([7, 1, 0]), // Days before
});

const updateCelebrationSchema = createCelebrationSchema.omit({ personId: true }).partial();

const celebrationsRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Create celebration
  fastify.post('/', async (request, reply) => {
    const body = createCelebrationSchema.parse(request.body);

    // Validate: life events require a title
    if (body.type === CelebrationType.LIFE_EVENT && !body.title) {
      return reply.code(400).send({ error: 'Life events require a title' });
    }

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

    // Set recurring rule for birthdays and anniversaries
    let recurringRule = body.recurringRule;
    if (body.type === CelebrationType.BIRTHDAY || body.type === CelebrationType.ANNIVERSARY) {
      recurringRule = recurringRule || 'FREQ=YEARLY';
    }

    const celebration = await fastify.prisma.celebration.create({
      data: {
        personId: body.personId,
        type: body.type,
        title: body.title,
        date: body.date,
        recurringRule,
        reminderOffsets: body.reminderOffsets,
      },
    });

    // Schedule reminders
    await scheduleCelebrationReminders(
      fastify.prisma,
      request.user.userId,
      celebration.id,
      celebration.date,
      celebration.reminderOffsets
    );

    return reply.code(201).send(celebration);
  });

  // Update celebration
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updateCelebrationSchema.parse(request.body);

    // Verify celebration belongs to user's person
    const celebration = await fastify.prisma.celebration.findFirst({
      where: {
        id: request.params.id,
        person: { userId: request.user.userId },
      },
    });

    if (!celebration) {
      return reply.code(404).send({ error: 'Celebration not found' });
    }

    const updated = await fastify.prisma.celebration.update({
      where: { id: request.params.id },
      data: body,
    });

    // Reschedule reminders if date or offsets changed
    if (body.date || body.reminderOffsets) {
      await scheduleCelebrationReminders(
        fastify.prisma,
        request.user.userId,
        updated.id,
        updated.date,
        updated.reminderOffsets
      );
    }

    return updated;
  });

  // Delete celebration
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify celebration belongs to user's person
    const celebration = await fastify.prisma.celebration.findFirst({
      where: {
        id: request.params.id,
        person: { userId: request.user.userId },
      },
    });

    if (!celebration) {
      return reply.code(404).send({ error: 'Celebration not found' });
    }

    await fastify.prisma.celebration.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Get upcoming celebrations (next 30 days)
  fastify.get('/upcoming', async (request) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // For recurring events, we need to check the month/day
    const celebrations = await fastify.prisma.celebration.findMany({
      where: {
        person: { userId: request.user.userId },
      },
      include: { person: true },
    });

    // Filter and sort by upcoming date
    const upcoming = celebrations
      .map((c) => {
        // For recurring events, calculate next occurrence
        if (c.recurringRule) {
          const nextDate = getNextOccurrence(c.date, now);
          return { ...c, nextDate };
        }
        // For one-off events, use the actual date
        return { ...c, nextDate: c.date };
      })
      .filter((c) => c.nextDate >= now && c.nextDate <= thirtyDaysFromNow)
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

    return upcoming;
  });
};

/**
 * Get the next occurrence of a yearly recurring date
 */
function getNextOccurrence(originalDate: Date, fromDate: Date): Date {
  const thisYear = fromDate.getFullYear();
  const nextDate = new Date(originalDate);
  nextDate.setFullYear(thisYear);

  // If this year's date has passed, use next year
  if (nextDate < fromDate) {
    nextDate.setFullYear(thisYear + 1);
  }

  return nextDate;
}

export default celebrationsRoutes;
