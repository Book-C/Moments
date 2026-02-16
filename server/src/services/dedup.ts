import { PrismaClient, Person, Identity } from '@prisma/client';
import { normalizePhone, normalizeEmail } from '../utils/normalize.js';

export interface DuplicateSuggestion {
  person1: Person & { identities: Identity[] };
  person2: Person & { identities: Identity[] };
  matchType: 'phone' | 'email';
  matchValue: string;
}

/**
 * Find existing person with matching identity (for auto-linking)
 */
export async function findMatchingPerson(
  prisma: PrismaClient,
  userId: string,
  phone?: string,
  email?: string
): Promise<Person | null> {
  const normalizedPhone = phone ? normalizePhone(phone) : null;
  const normalizedEmail = email ? normalizeEmail(email) : null;

  if (!normalizedPhone && !normalizedEmail) {
    return null;
  }

  // Look for existing identities with matching phone or email
  const matchingIdentity = await prisma.identity.findFirst({
    where: {
      person: { userId },
      OR: [
        normalizedPhone ? { normalizedPhone } : {},
        normalizedEmail ? { normalizedEmail } : {},
      ].filter((o) => Object.keys(o).length > 0),
    },
    include: { person: true },
  });

  return matchingIdentity?.person || null;
}

/**
 * Get suggested duplicate matches for manual review
 * Only suggests matches based on phone/email, never name
 */
export async function getSuggestedDuplicates(
  prisma: PrismaClient,
  userId: string
): Promise<DuplicateSuggestion[]> {
  // Get all people with their identities for this user
  const people = await prisma.person.findMany({
    where: { userId },
    include: { identities: true },
  });

  const suggestions: DuplicateSuggestion[] = [];
  const seenPairs = new Set<string>();

  // Build maps of normalized values to people
  const phoneMap = new Map<string, (Person & { identities: Identity[] })[]>();
  const emailMap = new Map<string, (Person & { identities: Identity[] })[]>();

  for (const person of people) {
    for (const identity of person.identities) {
      if (identity.normalizedPhone) {
        const existing = phoneMap.get(identity.normalizedPhone) || [];
        existing.push(person);
        phoneMap.set(identity.normalizedPhone, existing);
      }
      if (identity.normalizedEmail) {
        const existing = emailMap.get(identity.normalizedEmail) || [];
        existing.push(person);
        emailMap.set(identity.normalizedEmail, existing);
      }
    }
  }

  // Find duplicates by phone
  for (const [phone, matchingPeople] of phoneMap.entries()) {
    if (matchingPeople.length >= 2) {
      for (let i = 0; i < matchingPeople.length; i++) {
        for (let j = i + 1; j < matchingPeople.length; j++) {
          const pairKey = [matchingPeople[i].id, matchingPeople[j].id].sort().join('-');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            suggestions.push({
              person1: matchingPeople[i],
              person2: matchingPeople[j],
              matchType: 'phone',
              matchValue: phone,
            });
          }
        }
      }
    }
  }

  // Find duplicates by email
  for (const [email, matchingPeople] of emailMap.entries()) {
    if (matchingPeople.length >= 2) {
      for (let i = 0; i < matchingPeople.length; i++) {
        for (let j = i + 1; j < matchingPeople.length; j++) {
          const pairKey = [matchingPeople[i].id, matchingPeople[j].id].sort().join('-');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            suggestions.push({
              person1: matchingPeople[i],
              person2: matchingPeople[j],
              matchType: 'email',
              matchValue: email,
            });
          }
        }
      }
    }
  }

  return suggestions;
}

/**
 * Merge two people (manual merge operation)
 * Keeps person1, transfers all data from person2, then deletes person2
 */
export async function mergePeople(
  prisma: PrismaClient,
  userId: string,
  person1Id: string,
  person2Id: string
): Promise<Person> {
  // Verify both people belong to this user
  const [person1, person2] = await Promise.all([
    prisma.person.findFirst({ where: { id: person1Id, userId } }),
    prisma.person.findFirst({ where: { id: person2Id, userId } }),
  ]);

  if (!person1 || !person2) {
    throw new Error('One or both people not found');
  }

  // Transfer all related data from person2 to person1
  await prisma.$transaction([
    // Transfer identities
    prisma.identity.updateMany({
      where: { personId: person2Id },
      data: { personId: person1Id },
    }),
    // Transfer addresses
    prisma.address.updateMany({
      where: { personId: person2Id },
      data: { personId: person1Id },
    }),
    // Transfer celebrations
    prisma.celebration.updateMany({
      where: { personId: person2Id },
      data: { personId: person1Id },
    }),
    // Transfer event guest records
    prisma.eventGuest.updateMany({
      where: { personId: person2Id },
      data: { personId: person1Id },
    }),
    // Delete person2
    prisma.person.delete({ where: { id: person2Id } }),
  ]);

  // Return updated person1 with all data
  return prisma.person.findUniqueOrThrow({
    where: { id: person1Id },
    include: {
      identities: true,
      addresses: true,
      celebrations: true,
    },
  });
}
