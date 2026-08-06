import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { initDB, seedAdmin, createTestUser, cleanupDB } from './bootstrap.mjs';
import { signTwoFactorToken } from '../src/utils/jwt.js';

jest.unstable_mockModule('../src/utils/email.js', () => {
  const mockSuccess = jest.fn().mockResolvedValue(true);
  return {
    sendEmail: mockSuccess,
    sendVerificationEmail: mockSuccess,
    sendPasswordResetEmail: mockSuccess,
    sendOTPEmail: mockSuccess,
    sendSuspiciousLoginEmail: mockSuccess,
    default: {
      sendEmail: mockSuccess,
      sendVerificationEmail: mockSuccess,
      sendPasswordResetEmail: mockSuccess,
      sendOTPEmail: mockSuccess,
      sendSuspiciousLoginEmail: mockSuccess,
    },
  };
});

jest.unstable_mockModule('../src/services/security/gemini.js', () => {
  const mockAsk = jest.fn().mockResolvedValue('Mocked Gemini response');
  const mockIsConfigured = jest.fn().mockReturnValue(true);
  return {
    ask: mockAsk,
    isConfigured: mockIsConfigured,
    default: { ask: mockAsk, isConfigured: mockIsConfigured },
  };
});

jest.unstable_mockModule('../src/services/ai/aiRouter.js', () => ({
  routeAI: jest.fn().mockResolvedValue({ response: 'Mocked AI response', provider: 'mock' }),
  routeMultimodalAI: jest.fn().mockResolvedValue({ response: 'Mocked multimodal response', provider: 'mock' }),
  isConfigured: jest.fn().mockReturnValue(true),
}));

let app;
let adminToken;
let userToken;
let userId;

beforeAll(async () => {
  await initDB();
  const admin = await seedAdmin();
  const user = await createTestUser({ email: 'testuser@test.com', password: 'P@ssw0rd123!' });
  userId = user._id.toString();

  const appModule = await import('../src/app.js');
  app = appModule.default;

  // Get tokens once
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'testpass123' });
  adminToken = adminRes.body?.accessToken;

  const userRes = await request(app).post('/api/auth/login').send({ email: 'testuser@test.com', password: 'P@ssw0rd123!' });
  userToken = userRes.body?.accessToken;
}, 120000);

afterAll(async () => {
  await cleanupDB();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    test('registers a new user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'New User',
        email: 'newuser@test.com',
        password: 'Str0ngP@ss1!',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('newuser@test.com');
    });

    test('rejects duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate',
        email: 'testuser@test.com',
        password: 'Str0ngP@ss1!',
      });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('rejects invalid payload', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'ab',
        email: 'invalid',
        password: '123',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    test('logs in with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    test('rejects invalid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'wrongpass',
      });
      expect(res.status).toBe(401);
    });

    test('rejects disabled account', async () => {
      await createTestUser({ email: 'disabled@test.com', password: 'P@ssw0rd123!', isActive: false });
      const res = await request(app).post('/api/auth/login').send({
        email: 'disabled@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(403);
    });

    test('locks account after too many failed attempts', async () => {
      const lockUser = await createTestUser({ email: 'lock@test.com', password: 'P@ssw0rd123!' });

      // MAX_LOGIN_ATTEMPTS = 5 by default (config.security.maxLoginAttempts)
      for (let i = 0; i < 5; i++) {
        const failRes = await request(app).post('/api/auth/login').send({
          email: 'lock@test.com',
          password: 'wrongpass',
        });
        expect(failRes.status).toBe(401);
      }

      // Even correct password should be rejected while locked
      const res = await request(app).post('/api/auth/login').send({
        email: 'lock@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('locked');
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns current user', async () => {
      const res = await request(app).get('/api/auth/me').set(auth(userToken));
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('testuser@test.com');
    });

    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('rejects request from inactive user with valid token (protect middleware)', async () => {
      const inactiveUser = await createTestUser({ email: 'inactive-protect@test.com', password: 'P@ssw0rd123!' });
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'inactive-protect@test.com',
        password: 'P@ssw0rd123!',
      });
      const token = loginRes.body?.accessToken;
      expect(token).toBeDefined();

      // Deactivate the user account
      inactiveUser.isActive = false;
      await inactiveUser.save();

      const res = await request(app).get('/api/auth/me').set(auth(token));
      expect(res.status).toBe(403);
    });

    test('rejects request from deleted user (protect middleware)', async () => {
      const delUser = await createTestUser({ email: 'deleted-protect@test.com', password: 'P@ssw0rd123!' });
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'deleted-protect@test.com',
        password: 'P@ssw0rd123!',
      });
      const token = loginRes.body?.accessToken;
      expect(token).toBeDefined();

      // Delete the user account
      await delUser.deleteOne();

      const res = await request(app).get('/api/auth/me').set(auth(token));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('logs out user', async () => {
      const res = await request(app).post('/api/auth/logout').set(auth(userToken));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('refreshes access token', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'P@ssw0rd123!',
      });
      const cookies = loginRes.headers['set-cookie'];
      const refreshCookie = cookies?.find(c => c.startsWith('refreshToken='));
      const refreshToken = refreshCookie ? refreshCookie.split(';')[0].split('=')[1] : null;

      expect(refreshToken).toBeDefined();

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    test('rejects missing refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('changes password successfully', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(auth(userToken))
        .send({ currentPassword: 'P@ssw0rd123!', newPassword: 'N3wP@ssw0rd!' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('rejects wrong current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(auth(userToken))
        .send({ currentPassword: 'wrongpass', newPassword: 'N3wP@ssw0rd!' });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/auth/me', () => {
    test('updates name', async () => {
      const res = await request(app)
        .patch('/api/auth/me')
        .set(auth(userToken))
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('sends reset email for existing account', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'testuser@test.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('prevents user enumeration - same response for non-existing email', async () => {
      const existingRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'testuser@test.com' });

      const nonExistingRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent-user@test.com' });

      expect(existingRes.status).toBe(200);
      expect(nonExistingRes.status).toBe(200);
      expect(existingRes.body.message).toBe(nonExistingRes.body.message);
    });
  });

  describe('POST /api/auth/forgot-password/send-otp', () => {
    test('sends OTP for existing account', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/send-otp')
        .send({ email: 'testuser@test.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('prevents user enumeration - same response for non-existing email', async () => {
      const existingRes = await request(app)
        .post('/api/auth/forgot-password/send-otp')
        .send({ email: 'testuser@test.com' });

      const nonExistingRes = await request(app)
        .post('/api/auth/forgot-password/send-otp')
        .send({ email: 'nonexistent-user@test.com' });

      expect(existingRes.status).toBe(200);
      expect(nonExistingRes.status).toBe(200);
    });
  });

  describe('POST /api/auth/forgot-password/verify-otp', () => {
    test('rejects invalid OTP', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/verify-otp')
        .send({ email: 'testuser@test.com', otp: '000000' });
      expect(res.status).toBe(400);
    });

    test('rejects missing OTP (validation failure)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/verify-otp')
        .send({ email: 'testuser@test.com' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    test('rejects invalid 2FA code with valid twoFactorToken', async () => {
      // Generate a short-lived signed 2FA token for the user
      const twoFactorToken = signTwoFactorToken(userId);
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ twoFactorToken, otp: '000000' });
      expect(res.status).toBe(401);
    });

    test('requires twoFactorToken (no userId accepted)', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ userId, otp: '123456' });
      expect(res.status).toBe(422);
    });

    test('rejects invalid twoFactorToken', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ twoFactorToken: 'invalid-token', otp: '123456' });
      expect([401, 422]).toContain(res.status);
    });
  });

  describe('POST /api/auth/login-enhanced', () => {
    test('handles suspicious login detection', async () => {
      // Use a fresh user to avoid password change side effects from previous tests
      const freshUser = await createTestUser({ email: 'enhanced@test.com', password: 'P@ssw0rd123!' });
      const res = await request(app).post('/api/auth/login-enhanced').send({
        email: 'enhanced@test.com',
        password: 'P@ssw0rd123!',
        device: 'New Device',
        location: 'New Location',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    test('locks account via login-enhanced after too many failed attempts', async () => {
      const enhancedLockUser = await createTestUser({ email: 'enhanced-lock@test.com', password: 'P@ssw0rd123!' });

      for (let i = 0; i < 5; i++) {
        const failRes = await request(app).post('/api/auth/login-enhanced').send({
          email: 'enhanced-lock@test.com',
          password: 'wrongpass',
        });
        expect(failRes.status).toBe(401);
      }

      const res = await request(app).post('/api/auth/login-enhanced').send({
        email: 'enhanced-lock@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('locked');
    });

    test('rejects unverified email via login-enhanced', async () => {
      const unverified = await createTestUser({ email: 'unverified-enhanced@test.com', password: 'P@ssw0rd123!', isEmailVerified: false });
       const res = await request(app).post('/api/auth/login-enhanced').send({
        email: 'unverified-enhanced@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Security Hardening', () => {
    test('rejects weak password on registration (missing uppercase)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak User',
        email: 'weak1@test.com',
        password: 'alllowercase1!',
      });
      expect(res.status).toBe(422);
    });

    test('rejects weak password on registration (missing special char)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak User',
        email: 'weak2@test.com',
        password: 'NoSpecialChar1',
      });
      expect(res.status).toBe(422);
    });

    test('rejects weak password on registration (too short)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak User',
        email: 'weak3@test.com',
        password: 'Ab1!',
      });
      expect(res.status).toBe(422);
    });

    test('rejects invalid JWT access token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    test('rejects request with no authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('rejects malformed authorization header', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'NotBearer abc123');
      expect(res.status).toBe(401);
    });

    test('refresh token rotation invalidates old refresh token', async () => {
      const secUser = await createTestUser({ email: 'sectest-refresh@test.com', password: 'P@ssw0rd123!' });
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'sectest-refresh@test.com',
        password: 'P@ssw0rd123!',
      });
      const cookies = loginRes.headers['set-cookie'];
      const refreshCookie = cookies?.find(c => c.startsWith('refreshToken='));
      const refreshToken = refreshCookie ? refreshCookie.split(';')[0].split('=')[1] : null;

      expect(refreshToken).toBeDefined();

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();

      const newCookies = refreshRes.headers['set-cookie'];
      const newRefreshCookie = newCookies?.find(c => c.startsWith('refreshToken='));
      const newRefreshToken = newRefreshCookie ? newRefreshCookie.split(';')[0].split('=')[1] : null;

      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(refreshToken);

      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      expect(reuseRes.status).toBe(401);
    });

    test('rejects unregistered user email on login (existing email but unregistered)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@test.com',
        password: 'P@ssw0rd123!',
      });
      expect(res.status).toBe(401);
    });

    test('change-password validates new password complexity', async () => {
      const secUser = await createTestUser({ email: 'sectest-changepw@test.com', password: 'P@ssw0rd123!' });
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'sectest-changepw@test.com',
        password: 'P@ssw0rd123!',
      });
      const token = loginRes.body?.accessToken;
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(auth(token))
        .send({ currentPassword: 'P@ssw0rd123!', newPassword: 'weak' });
      expect(res.status).toBe(422);
    });
  });
});