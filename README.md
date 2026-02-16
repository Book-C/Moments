# Moments

A mobile-first personal relationship assistant that helps you remember important moments, get reminders, store addresses, and invite contacts to private events.

## Design Principles (Hard Constraints)

**This is NOT a social network.** The following are strictly prohibited:

- No public profiles
- No feeds or discovery features
- No followers or following
- No business accounts
- No mass invites

**Core Values:**

- **Private & People-First**: Contact-centric like WhatsApp, not public like Instagram
- **Clean & Calm UI**: Inspired by Apple Reminders, WhatsApp, and Headspace (the calmness, not the visuals)
- **Native Platform Patterns**: Use SwiftUI patterns on iOS, Material Design on Android
- **Friendly Microcopy**: Human, warm language throughout
- **Privacy-First Defaults**: Opt-in for everything, minimal data collection
- **Anti-Spam Protections**: Rate limits, invite expiry, block/report features

## Architecture

```
moments/
├── server/          # Fastify + TypeScript + Prisma API
├── mobile/          # React Native Expo app
└── web-rsvp/        # Next.js RSVP pages
```

## Features

### MVP (Implemented)

- **Authentication**: Email + phone verification (stubs in place)
- **People Management**: Create, edit, delete contacts
- **Identities**: Phone, email, social handles per person
- **Deduplication**: Auto-link by normalized phone/email, manual merge UI
- **Celebrations**: Birthdays (yearly), anniversaries (yearly), life events (one-off)
- **Reminder Offsets**: Configurable days-before reminders (default: 7, 1, 0)
- **Addresses**: Multiple addresses per person with labels
- **Private Events**: Create events with invite tokens
- **RSVP**: Web-based RSVP without requiring an account
- **Anti-Spam**: Rate limiting (10 invites/hour), invite expiry (7 days), block/report
- **Notifications**: Scheduled reminders + weekly email digest (cron jobs)

### V1 (Post-MVP)

- Google Calendar + Outlook sync
- To-do integrations (Todoist, Microsoft To Do, Google Tasks)
- Smart duplicate suggestions
- Partner links (cards/flowers/gifts)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm, npm, or yarn

## Setup

### 1. Clone and Install

```bash
cd moments

# Install dependencies
npm install

# Install server dependencies
cd server && npm install

# Install web-rsvp dependencies
cd ../web-rsvp && npm install

# Return to root
cd ..
```

### 2. Database Setup

```bash
# Copy environment file
cp server/.env.example server/.env

# Edit server/.env with your PostgreSQL connection string
# DATABASE_URL="postgresql://user:password@localhost:5432/moments"

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed demo data
npm run db:seed
```

### 3. Start Development Servers

```bash
# Terminal 1: Start API server (port 3001)
npm run server:dev

# Terminal 2: Start web RSVP app (port 3000)
npm run web:dev

# Terminal 3: Start mobile app
cd mobile && npx expo start
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/send-phone-code` - Send phone verification code
- `POST /api/auth/verify-phone` - Verify phone with code
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/settings` - Update notification settings

### People
- `GET /api/people` - List all people
- `POST /api/people` - Create person
- `GET /api/people/:id` - Get person details
- `PUT /api/people/:id` - Update person
- `DELETE /api/people/:id` - Delete person
- `GET /api/people/duplicates` - Get suggested duplicates
- `POST /api/people/merge` - Merge two people

### Identities
- `POST /api/identities` - Add identity to person
- `DELETE /api/identities/:id` - Remove identity

### Addresses
- `POST /api/addresses` - Add address to person
- `PUT /api/addresses/:id` - Update address
- `DELETE /api/addresses/:id` - Delete address

### Celebrations
- `POST /api/celebrations` - Create celebration
- `PUT /api/celebrations/:id` - Update celebration
- `DELETE /api/celebrations/:id` - Delete celebration
- `GET /api/celebrations/upcoming` - Get next 30 days

### Events
- `GET /api/events` - List user's events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/invite` - Invite guest (rate limited)
- `GET /api/events/:id/guests` - List guests by status

### RSVP (Public)
- `GET /api/rsvp/:token` - Get event details
- `POST /api/rsvp/:token` - Submit RSVP

### Safety
- `POST /api/safety/block` - Block a contact
- `DELETE /api/safety/block/:id` - Unblock
- `GET /api/safety/blocked` - List blocked contacts
- `POST /api/safety/report` - Report abuse

## Demo Credentials

After running `npm run db:seed`:

```
Email: demo@moments.app
Password: password123
```

## Environment Variables

### Server (`server/.env`)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moments"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=3001
WEB_RSVP_URL="http://localhost:3000"
```

### Web RSVP (`web-rsvp/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Mobile (`mobile/.env`)

```env
EXPO_PUBLIC_API_URL="http://localhost:3001"
```

## Database Schema

See `server/prisma/schema.prisma` for the complete schema. Key models:

- **User**: Account with email, phone, notification preferences
- **Person**: Contact with display name, relationship tag, notes
- **Identity**: Phone/email/social handles linked to a person
- **Address**: Postal addresses for a person
- **Celebration**: Birthday, anniversary, or life event
- **Event**: Private event with invite token and expiry
- **EventGuest**: Guest RSVPs with status

## Deduplication Rules

1. **Auto-Link Only**: When adding an identity with a phone/email that already exists for another person (same user), the system flags a potential duplicate
2. **Never Auto-Merge by Name**: Name matching is not used for deduplication
3. **Manual Merge**: User must explicitly confirm merging two people
4. **Merge Operation**: Transfers all identities, addresses, celebrations, and event guests to the primary person

## Rate Limiting

- **Invite Rate Limit**: 10 invites per hour per user
- **Tracked via**: `RateLimitLog` table with hourly windows
- **Response**: 429 Too Many Requests with retry-after hint

## Cron Jobs

The server runs two background jobs:

1. **Reminder Processing** (every hour): Sends due reminders for celebrations and events
2. **Weekly Digest** (daily at 9 AM): Sends digest emails to users whose `digestDay` matches

## Mobile App Structure

```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout with providers
│   ├── index.tsx            # Auth redirect screen
│   ├── (auth)/              # Login & register screens
│   ├── (tabs)/              # Main tab navigation
│   │   ├── index.tsx        # Home (upcoming celebrations)
│   │   ├── people.tsx       # People list
│   │   ├── events.tsx       # Events list
│   │   └── settings.tsx     # User settings
│   └── people/[id].tsx      # Person detail modal
├── services/api.ts          # API client
└── stores/auth.ts           # Zustand auth store
```

## License

Private - All rights reserved
