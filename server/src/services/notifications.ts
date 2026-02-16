import { PrismaClient } from '@prisma/client';
import { sendBirthdayReminder, sendEventReminder } from './push.js';

/**
 * Schedule reminders for a celebration based on its reminder offsets
 */
export async function scheduleCelebrationReminders(
  prisma: PrismaClient,
  userId: string,
  celebrationId: string,
  date: Date,
  reminderOffsets: number[]
): Promise<void> {
  // Delete existing scheduled reminders for this celebration
  await prisma.scheduledReminder.deleteMany({
    where: { celebrationId },
  });

  // Create new reminders for each offset
  const reminders = reminderOffsets.map((daysBefore) => {
    const scheduledFor = new Date(date);
    scheduledFor.setDate(scheduledFor.getDate() - daysBefore);
    scheduledFor.setHours(9, 0, 0, 0); // Send at 9 AM

    return {
      userId,
      celebrationId,
      scheduledFor,
    };
  });

  await prisma.scheduledReminder.createMany({
    data: reminders,
  });
}

/**
 * Schedule reminders for an event
 */
export async function scheduleEventReminders(
  prisma: PrismaClient,
  userId: string,
  eventId: string,
  datetime: Date
): Promise<void> {
  // Delete existing scheduled reminders for this event
  await prisma.scheduledReminder.deleteMany({
    where: { eventId },
  });

  // Create reminders: 1 day before and 1 hour before
  const dayBefore = new Date(datetime);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  const hourBefore = new Date(datetime);
  hourBefore.setHours(hourBefore.getHours() - 1);

  await prisma.scheduledReminder.createMany({
    data: [
      { userId, eventId, scheduledFor: dayBefore },
      { userId, eventId, scheduledFor: hourBefore },
    ],
  });
}

/**
 * Calculate days until a date
 */
function getDaysUntil(targetDate: Date): number {
  const now = new Date();
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate hours until a date
 */
function getHoursUntil(targetDate: Date): number {
  const now = new Date();
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

/**
 * Process due reminders (called by cron job)
 */
export async function processDueReminders(prisma: PrismaClient): Promise<number> {
  const now = new Date();

  // Find all unsent reminders that are due
  const dueReminders = await prisma.scheduledReminder.findMany({
    where: {
      sent: false,
      scheduledFor: { lte: now },
    },
    include: {
      user: true,
      celebration: { include: { person: true } },
      event: true,
    },
    take: 100, // Process in batches
  });

  let processedCount = 0;

  for (const reminder of dueReminders) {
    try {
      // Send push notification for celebration (birthday, anniversary, etc.)
      if (reminder.celebration) {
        const daysUntil = getDaysUntil(reminder.celebration.date);
        const personName = reminder.celebration.person.displayName;

        console.log(
          `[REMINDER] Sending to ${reminder.user.email}: ${personName}'s ${reminder.celebration.type.toLowerCase()} in ${daysUntil} days`
        );

        // Send push notification if user has push enabled
        if (reminder.user.pushEnabled && reminder.user.pushToken) {
          await sendBirthdayReminder(prisma, reminder.userId, personName, Math.max(0, daysUntil));
        }
      }

      // Send push notification for event
      if (reminder.event) {
        const hoursUntil = getHoursUntil(reminder.event.datetime);
        const eventTitle = reminder.event.title;

        console.log(
          `[REMINDER] Sending to ${reminder.user.email}: Event "${eventTitle}" in ${hoursUntil} hours`
        );

        // Send push notification if user has push enabled
        if (reminder.user.pushEnabled && reminder.user.pushToken) {
          await sendEventReminder(prisma, reminder.userId, eventTitle, Math.max(0, hoursUntil));
        }
      }

      // Mark as sent
      await prisma.scheduledReminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: now },
      });

      processedCount++;
    } catch (error) {
      console.error(`Error processing reminder ${reminder.id}:`, error);
    }
  }

  return processedCount;
}
