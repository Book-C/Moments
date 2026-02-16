# Moments - Project Context

## Product Vision
Een mobiele persoonlijke relatie-assistent die gebruikers helpt om belangrijke momenten te onthouden (verjaardagen, jubilea, life events), herinneringen te krijgen, adressen op te slaan en contacten uit te nodigen voor privé-evenementen.

## Harde Constraints (NIET onderhandelbaar)

### Dit is GEEN sociaal netwerk
- Geen publieke profielen
- Geen feeds of discovery features
- Geen volgers/following
- Geen zakelijke accounts
- Geen massa-uitnodigingen

### Core Waarden
- **Privé & Mensen-eerst**: Contact-centrisch zoals WhatsApp
- **Clean & Calm UI**: Geïnspireerd door Apple Reminders, WhatsApp, Headspace
- **Native Platform Patterns**: SwiftUI op iOS, Material Design op Android
- **Vriendelijke Microcopy**: Menselijke, warme taal
- **Privacy-first Defaults**: Opt-in voor alles, minimale datacollectie
- **Anti-spam Protecties**: Rate limits, invite expiry, block/report

## Tech Stack

### Server (`/server`)
- **Runtime**: Node.js 18+
- **Framework**: Fastify 5.x
- **ORM**: Prisma + PostgreSQL
- **Auth**: JWT tokens (@fastify/jwt 10.x)
- **Validation**: Zod
- **Scheduling**: node-cron
- **Encryption**: crypto-js (AES voor gevoelige velden)
- **Testing**: Vitest

### Mobile (`/mobile`)
- **Framework**: React Native Expo (SDK 50)
- **Navigation**: expo-router
- **State**: Zustand
- **API**: Custom fetch client
- **Storage**: localStorage (web) / SecureStore (native)

### Web RSVP (`/web-rsvp`)
- **Framework**: Next.js 14
- **Styling**: Tailwind CSS

## Database Schema (Hoofdmodellen)
- **User**: Account met email, telefoon, notificatie-voorkeuren
- **Person**: Contact met naam, relatie-tag, notities
- **Identity**: Telefoon/email/social handles per persoon
- **Address**: Postadressen per persoon
- **Celebration**: Verjaardag, jubileum, of life event
- **Event**: Privé-event met invite token en expiry
- **EventGuest**: RSVP status per gast

## Deduplicatie Regels
1. Auto-link alleen op exacte normalized phone/email match
2. NOOIT auto-merge op naam alleen
3. Handmatige merge vereist expliciete bevestiging

## Security Features
- Database encryptie voor telefoon, adres velden
- Rate limiting: 10 invites per uur per user
- JWT authenticatie met expiry
- Zod input validatie
- Security tests aanwezig

## Taal
- UI: Nederlands
- Code/comments: Engels
