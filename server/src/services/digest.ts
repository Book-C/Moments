import { PrismaClient } from '@prisma/client';

interface DigestItem {
  type: 'celebration' | 'event';
  title: string;
  personName?: string;
  date: Date;
}

interface UserDigest {
  userId: string;
  email: string;
  items: DigestItem[];
}

/**
 * Generate weekly digest for a user
 */
export async function generateUserDigest(
  prisma: PrismaClient,
  userId: string
): Promise<UserDigest | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.emailDigestEnabled) {
    return null;
  }

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Get upcoming celebrations
  const celebrations = await prisma.celebration.findMany({
    where: {
      person: { userId },
      date: {
        gte: now,
        lte: nextWeek,
      },
    },
    include: { person: true },
  });

  // Get upcoming events
  const events = await prisma.event.findMany({
    where: {
      hostUserId: userId,
      datetime: {
        gte: now,
        lte: nextWeek,
      },
    },
  });

  const items: DigestItem[] = [
    ...celebrations.map((c) => ({
      type: 'celebration' as const,
      title: c.title || c.type.toLowerCase(),
      personName: c.person.displayName,
      date: c.date,
    })),
    ...events.map((e) => ({
      type: 'event' as const,
      title: e.title,
      date: e.datetime,
    })),
  ];

  // Sort by date
  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (items.length === 0) {
    return null;
  }

  return {
    userId,
    email: user.email,
    items,
  };
}

/**
 * Send weekly digest emails (called by cron job)
 */
export async function sendWeeklyDigests(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Find users who have digest enabled and today is their digest day
  const users = await prisma.user.findMany({
    where: {
      emailDigestEnabled: true,
      digestDay: currentDay,
    },
  });

  let sentCount = 0;

  for (const user of users) {
    const digest = await generateUserDigest(prisma, user.id);

    if (digest && digest.items.length > 0) {
      // In production, this would send an email via SendGrid/SES
      console.log(`[DIGEST] Sending weekly digest to ${digest.email}:`);
      for (const item of digest.items) {
        if (item.type === 'celebration') {
          console.log(`  - ${item.personName}'s ${item.title} on ${item.date.toDateString()}`);
        } else {
          console.log(`  - Event: ${item.title} on ${item.date.toDateString()}`);
        }
      }
      sentCount++;
    }
  }

  return sentCount;
}
