import Fastify from 'fastify';
import cors from '@fastify/cors';
import cron from 'node-cron';
import { ZodError } from 'zod';
import { config } from './config.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import identitiesRoutes from './routes/identities.js';
import addressesRoutes from './routes/addresses.js';
import celebrationsRoutes from './routes/celebrations.js';
import eventsRoutes from './routes/events.js';
import rsvpRoutes from './routes/rsvp.js';
import safetyRoutes from './routes/safety.js';
import { processDueReminders } from './services/notifications.js';
import { sendWeeklyDigests } from './services/digest.js';

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

await fastify.register(prismaPlugin);
await fastify.register(authPlugin);
await fastify.register(rateLimitPlugin);

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(peopleRoutes, { prefix: '/api/people' });
await fastify.register(identitiesRoutes, { prefix: '/api/identities' });
await fastify.register(addressesRoutes, { prefix: '/api/addresses' });
await fastify.register(celebrationsRoutes, { prefix: '/api/celebrations' });
await fastify.register(eventsRoutes, { prefix: '/api/events' });
await fastify.register(rsvpRoutes, { prefix: '/api/rsvp' });
await fastify.register(safetyRoutes, { prefix: '/api/safety' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Error handler for Zod validation errors
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validatiefout',
      details: error.errors,
    });
  }

  fastify.log.error(error);
  return reply.code(500).send({ error: 'Interne serverfout' });
});

// Schedule cron jobs
// Process reminders every hour
cron.schedule('0 * * * *', async () => {
  fastify.log.info('Running reminder processing job');
  try {
    const count = await processDueReminders(fastify.prisma);
    fastify.log.info(`Processed ${count} reminders`);
  } catch (error) {
    fastify.log.error({ err: error }, 'Error processing reminders');
  }
});

// Send weekly digests at 9 AM every day (will only send to users whose digestDay matches)
cron.schedule('0 9 * * *', async () => {
  fastify.log.info('Running weekly digest job');
  try {
    const count = await sendWeeklyDigests(fastify.prisma);
    fastify.log.info(`Sent ${count} weekly digests`);
  } catch (error) {
    fastify.log.error({ err: error }, 'Error sending digests');
  }
});

// Start server
try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`
🎉 Moments API Server running!

   Local:   http://localhost:${config.port}
   Health:  http://localhost:${config.port}/health

   API Endpoints:
   - POST /api/auth/register
   - POST /api/auth/login
   - GET  /api/people
   - GET  /api/celebrations/upcoming
   - GET  /api/events
   - GET  /api/rsvp/:token (public)
  `);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
