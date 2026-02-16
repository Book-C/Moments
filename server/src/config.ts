export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  webRsvpUrl: process.env.WEB_RSVP_URL || 'http://localhost:3000',

  email: {
    from: process.env.EMAIL_FROM || 'noreply@moments.app',
  },

  sms: {
    from: process.env.SMS_FROM || '+15555555555',
  },

  rateLimit: {
    invitesPerHour: 10,
    loginAttemptsPerHour: 10,     // Max login attempts per IP per hour
    registrationsPerHour: 5,      // Max registrations per IP per hour
    loginLockoutMinutes: 15,      // Lockout duration after max attempts
  },

  inviteExpiryDays: 7,
};
