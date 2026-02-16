import { PrismaClient, CelebrationType, SourceType, GuestStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@moments.app' },
    update: {},
    create: {
      email: 'demo@moments.app',
      phone: '+15551234567',
      passwordHash,
      emailVerified: true,
      phoneVerified: true,
      timezone: 'America/New_York',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create some people
  const people = [
    {
      displayName: 'Mom',
      relationshipTag: 'family',
      notes: 'Remember to call every Sunday!',
    },
    {
      displayName: 'John Smith',
      relationshipTag: 'friend',
      notes: 'Met at the coffee shop',
    },
    {
      displayName: 'Sarah Johnson',
      relationshipTag: 'colleague',
      notes: 'Works in the marketing department',
    },
  ];

  const createdPeople = [];

  for (const personData of people) {
    const person = await prisma.person.create({
      data: {
        ...personData,
        userId: user.id,
      },
    });
    createdPeople.push(person);
    console.log(`✅ Created person: ${person.displayName}`);
  }

  // Add identities
  await prisma.identity.create({
    data: {
      personId: createdPeople[0].id,
      sourceType: SourceType.PHONE,
      normalizedPhone: '+15559876543',
    },
  });

  await prisma.identity.create({
    data: {
      personId: createdPeople[1].id,
      sourceType: SourceType.EMAIL,
      normalizedEmail: 'john.smith@example.com',
    },
  });

  await prisma.identity.create({
    data: {
      personId: createdPeople[2].id,
      sourceType: SourceType.EMAIL,
      normalizedEmail: 'sarah.j@company.com',
    },
  });

  console.log('✅ Created identities');

  // Add addresses
  await prisma.address.create({
    data: {
      personId: createdPeople[0].id,
      label: 'Home',
      street: '123 Family Lane',
      city: 'Hometown',
      postalCode: '12345',
      country: 'US',
    },
  });

  console.log('✅ Created addresses');

  // Add celebrations
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await prisma.celebration.create({
    data: {
      personId: createdPeople[0].id,
      type: CelebrationType.BIRTHDAY,
      date: nextMonth,
      recurringRule: 'FREQ=YEARLY',
      reminderOffsets: [7, 1, 0],
    },
  });

  await prisma.celebration.create({
    data: {
      personId: createdPeople[1].id,
      type: CelebrationType.BIRTHDAY,
      date: nextWeek,
      recurringRule: 'FREQ=YEARLY',
      reminderOffsets: [7, 1, 0],
    },
  });

  await prisma.celebration.create({
    data: {
      personId: createdPeople[2].id,
      type: CelebrationType.LIFE_EVENT,
      title: 'Promotion',
      date: new Date('2024-03-15'),
      reminderOffsets: [1, 0],
    },
  });

  console.log('✅ Created celebrations');

  // Create an event
  const eventDate = new Date(now);
  eventDate.setDate(eventDate.getDate() + 14);
  eventDate.setHours(18, 0, 0, 0);

  const event = await prisma.event.create({
    data: {
      hostUserId: user.id,
      title: 'Birthday Dinner',
      datetime: eventDate,
      location: 'The Italian Place, 456 Main St',
      description: 'Join us for a birthday celebration!',
      inviteToken: nanoid(21),
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created event: ${event.title}`);
  console.log(`   Invite link: http://localhost:3000/rsvp/${event.inviteToken}`);

  // Add some guests
  await prisma.eventGuest.create({
    data: {
      eventId: event.id,
      personId: createdPeople[1].id,
      status: GuestStatus.ACCEPTED,
      respondedAt: new Date(),
    },
  });

  await prisma.eventGuest.create({
    data: {
      eventId: event.id,
      personId: createdPeople[2].id,
      status: GuestStatus.PENDING,
    },
  });

  console.log('✅ Created event guests');

  console.log(`
🎉 Seed completed!

Demo credentials:
  Email: demo@moments.app
  Password: password123

Test the API:
  curl -X POST http://localhost:3001/api/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"email":"demo@moments.app","password":"password123"}'
`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
