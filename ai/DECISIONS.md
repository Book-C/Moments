# Moments - Architectural & Product Decisions

## 2026-02-09: Initial Architecture
**Decision**: Monorepo met /server, /mobile, /web-rsvp structuur
**Rationale**: Centrale codebase, gedeelde types mogelijk, eenvoudiger deployment

## 2026-02-09: Fastify over Express
**Decision**: Fastify als API framework
**Rationale**: Betere TypeScript support, sneller, plugin-systeem

## 2026-02-09: Prisma als ORM
**Decision**: Prisma met PostgreSQL
**Rationale**: Type-safe queries, automatische migrations, goede DX

## 2026-02-09: Expo voor Mobile
**Decision**: React Native Expo (managed workflow)
**Rationale**: Snellere ontwikkeling, OTA updates, geen native build setup nodig initieel

## 2026-02-12: Server-based Architecture (ipv Local-first)
**Decision**: Data op centrale server opslaan, niet alleen lokaal op telefoon
**Rationale**:
- Email digest vereist server-side kennis van verjaardagen
- Cross-device sync mogelijk
- Verjaardag-verzoek links moeten ergens data opslaan
- Push notifications via server

## 2026-02-13: Database Encryptie
**Decision**: AES encryptie voor gevoelige velden (telefoon, adres)
**Rationale**:
- Extra beschermingslaag bij database breach
- GDPR compliance
- Email/hashed values blijven doorzoekbaar

## 2026-02-13: Fastify 5.x Upgrade
**Decision**: Upgrade naar Fastify 5.7.4, @fastify/jwt 10.x, @fastify/cors 11.x
**Rationale**: Security vulnerabilities fixen in oudere versies

## 2026-02-13: Vitest voor Testing
**Decision**: Vitest als test framework
**Rationale**: Sneller dan Jest, native ESM support, goede Vite integratie
