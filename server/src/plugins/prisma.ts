import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '../utils/encryption.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Fields to encrypt per model
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ['phone'],
  Identity: ['normalizedPhone'],
  Address: ['street', 'city', 'postalCode'],
  EventGuest: ['invitedPhone'],
  BlockedContact: ['blockedPhone'],
};

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Middleware to encrypt fields before writing
  prisma.$use(async (params, next) => {
    const fields = ENCRYPTED_FIELDS[params.model || ''];

    if (fields && params.args?.data) {
      const data = params.args.data;
      for (const field of fields) {
        if (data[field] && typeof data[field] === 'string') {
          data[field] = encrypt(data[field]);
        }
      }
    }

    const result = await next(params);

    // Decrypt fields after reading
    if (fields && result) {
      const decryptResult = (obj: any) => {
        if (!obj || typeof obj !== 'object') return obj;
        for (const field of fields) {
          if (obj[field] && typeof obj[field] === 'string') {
            obj[field] = decrypt(obj[field]);
          }
        }
        return obj;
      };

      if (Array.isArray(result)) {
        result.forEach(decryptResult);
      } else {
        decryptResult(result);
      }
    }

    return result;
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, { name: 'prisma' });
