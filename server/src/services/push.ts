import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();

interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification(
  prisma: PrismaClient,
  notification: PushNotification
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { pushToken: true, pushEnabled: true },
  });

  if (!user?.pushToken || !user.pushEnabled) {
    return false;
  }

  // Validate the push token
  if (!Expo.isExpoPushToken(user.pushToken)) {
    console.error(`Invalid Expo push token: ${user.pushToken}`);
    return false;
  }

  const message: ExpoPushMessage = {
    to: user.pushToken,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data,
  };

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];

    if (ticket.status === 'error') {
      console.error(`Push notification error: ${ticket.message}`);

      // Handle invalid tokens
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Remove invalid token
        await prisma.user.update({
          where: { id: notification.userId },
          data: { pushToken: null, pushPlatform: null },
        });
      }

      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

export async function sendBirthdayReminder(
  prisma: PrismaClient,
  userId: string,
  personName: string,
  daysUntil: number
): Promise<boolean> {
  let title: string;
  let body: string;

  if (daysUntil === 0) {
    title = `${personName} is vandaag jarig! 🎂`;
    body = 'Vergeet niet te feliciteren!';
  } else if (daysUntil === 1) {
    title = `${personName} is morgen jarig! 🎉`;
    body = `Bereid je voor om ${personName} te feliciteren`;
  } else {
    title = `${personName} is over ${daysUntil} dagen jarig`;
    body = `Zet alvast een reminder om ${personName} te feliciteren`;
  }

  return sendPushNotification(prisma, {
    userId,
    title,
    body,
    data: { type: 'birthday', personName, daysUntil },
  });
}

export async function sendEventReminder(
  prisma: PrismaClient,
  userId: string,
  eventTitle: string,
  hoursUntil: number
): Promise<boolean> {
  let title: string;
  let body: string;

  if (hoursUntil <= 1) {
    title = `${eventTitle} begint zo! ⏰`;
    body = 'Het evenement begint binnen een uur';
  } else if (hoursUntil <= 24) {
    title = `${eventTitle} is vandaag`;
    body = `Het evenement begint over ${hoursUntil} uur`;
  } else {
    const days = Math.floor(hoursUntil / 24);
    title = `${eventTitle} over ${days} ${days === 1 ? 'dag' : 'dagen'}`;
    body = 'Vergeet niet je agenda vrij te houden';
  }

  return sendPushNotification(prisma, {
    userId,
    title,
    body,
    data: { type: 'event', eventTitle, hoursUntil },
  });
}
