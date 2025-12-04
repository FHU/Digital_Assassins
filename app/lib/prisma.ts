/**
 * Prisma Client Singleton
 * Prevents multiple instances of PrismaClient in development
 * See: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/instantiate-prisma-client
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
