import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encrypt, decrypt, hash } from '../src/utils/encryption.js';

describe('Security Tests', () => {
  describe('Encryption', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const original = '+31612345678';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext for same plaintext (due to IV)', () => {
      const original = 'test@example.com';
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);

      // AES with random IV should produce different ciphertext
      // Note: CryptoJS AES uses random salt by default
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      expect(encrypt('')).toBe('');
      expect(decrypt('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(encrypt(null as any)).toBe(null);
      expect(decrypt(undefined as any)).toBe(undefined);
    });

    it('should hash consistently', () => {
      const value = 'test@example.com';
      const hash1 = hash(value);
      const hash2 = hash(value);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(value);
    });
  });

  describe('Authentication Security', () => {
    const API_URL = 'http://localhost:3001';

    it('should reject requests without authentication', async () => {
      const response = await fetch(`${API_URL}/api/people`);
      expect(response.status).toBe(401);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await fetch(`${API_URL}/api/people`, {
        headers: {
          Authorization: 'Bearer invalid-token-here',
        },
      });
      expect(response.status).toBe(401);
    });

    it('should reject expired JWT tokens', async () => {
      // This is a properly formatted but expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';
      const response = await fetch(`${API_URL}/api/people`, {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });
      expect(response.status).toBe(401);
    });

    it('should reject login with wrong password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@moments.app',
          password: 'wrongpassword',
        }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject login with non-existent user', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        }),
      });
      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    const API_URL = 'http://localhost:3001';

    it('should reject registration with invalid email', async () => {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'password123',
        }),
      });
      expect(response.status).toBe(400);
    });

    it('should reject registration with short password', async () => {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: '123',
        }),
      });
      expect(response.status).toBe(400);
    });

    it('should reject malformed JSON', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      });
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    const API_URL = 'http://localhost:3001';

    it('should allow normal login attempts', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@moments.app',
          password: 'password123',
        }),
      });
      expect(response.status).toBe(200);
    });

    it('should return 429 after too many failed login attempts', async () => {
      // Make 11 failed login attempts (limit is 10)
      for (let i = 0; i < 11; i++) {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '192.168.99.99', // Use unique IP for this test
          },
          body: JSON.stringify({
            email: 'test@nonexistent.com',
            password: 'wrongpassword',
          }),
        });

        if (i >= 10) {
          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error).toBe('Te veel inlogpogingen');
        }
      }
    });
  });

  describe('RSVP Token Security', () => {
    const API_URL = 'http://localhost:3001';

    it('should reject invalid RSVP tokens', async () => {
      const response = await fetch(`${API_URL}/api/rsvp/invalid-token-123`);
      expect(response.status).toBe(404);
    });

    it('should not expose sensitive host data in RSVP response', async () => {
      // First get a valid token from an event
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@moments.app',
          password: 'password123',
        }),
      });
      const { token } = await loginResponse.json();

      const eventsResponse = await fetch(`${API_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const events = await eventsResponse.json();

      if (events.length > 0) {
        const inviteToken = events[0].inviteToken;
        const rsvpResponse = await fetch(`${API_URL}/api/rsvp/${inviteToken}`);
        const rsvpData = await rsvpResponse.json();

        // Should not expose user ID or password hash
        expect(rsvpData.hostUserId).toBeUndefined();
        expect(rsvpData.passwordHash).toBeUndefined();
        expect(rsvpData.host?.passwordHash).toBeUndefined();
      }
    });
  });
});
