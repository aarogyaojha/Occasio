import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import app from '../../src/app';
import db from '../../src/db/knex';
import { authenticate } from '../../src/middleware/auth.middleware';
import { errorHandler } from '../../src/middleware/error.middleware';
import { sendResponse } from '../../src/utils/sendResponse';
import { resetRateLimiters } from '../../src/middleware/rateLimiter.middleware';
import { errorCodes, errorMessages, REFRESH_TOKEN_COOKIE_NAME, httpStatus } from '../../src/constants';
import { sendVerificationEmail } from '../../src/utils/sendVerificationEmail';
import { generateSync } from 'otplib';

vi.mock('../../src/utils/sendVerificationEmail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/config/mailer', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({}),
  },
}));

describe('Auth Module Integration Tests', () => {
  // Test app for protected route verification
  const testApp = express();
  testApp.use(cookieParser());
  testApp.use(express.json());
  testApp.use('/auth', app);
  testApp.get('/protected', authenticate, (req, res) => {
    sendResponse(res, httpStatus.OK, {
      user: req.user,
      message: 'Protected resource access granted',
    });
  });
  testApp.use(errorHandler);

  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimiters();
    await db('events').del();
    await db('email_verification_tokens').del();
    await db('refresh_tokens').del();
    await db('users').del();
  });

  afterAll(async () => {
    await db('events').del();
    await db('email_verification_tokens').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('POST /auth/signup', () => {
    it('should successfully register a new unverified user without issuing session tokens', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(httpStatus.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).not.toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.user).toMatchObject({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });
      expect(Boolean(response.body.data.user.email_verified)).toBe(false);
      expect(response.body.data.user).not.toHaveProperty('password_hash');

      // Check cookie is not set
      expect(response.headers['set-cookie']).toBeUndefined();

      // Verify sendVerificationEmail called with right arguments
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'jane@example.com',
        expect.stringContaining('/verify-email?token=')
      );

      // Verify user in DB
      const userInDb = await db('users').where({ email: 'jane@example.com' }).first();
      expect(userInDb).toBeDefined();
      expect(userInDb.name).toBe('Jane Doe');
      expect(Boolean(userInDb.email_verified)).toBe(false);

      // Verify token created in DB
      const tokenInDb = await db('email_verification_tokens').where({ user_id: userInDb.id }).first();
      expect(tokenInDb).toBeDefined();
      expect(tokenInDb.used_at).toBeNull();
    });

    it('should reject signup with duplicate email', async () => {
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'password456',
        });

      expect(response.status).toBe(httpStatus.CONFLICT);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(errorCodes.AUTH_EMAIL_TAKEN);
    });

    it('should reject signup with invalid input (short password)', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: 'short',
        });

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(errorCodes.VALIDATION_ERROR);
      expect(Array.isArray(response.body.error.details)).toBe(true);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'correctpassword123',
        });
    });

    it('should reject login if email is not verified (403 EMAIL_NOT_VERIFIED)', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctpassword123',
        });

      expect(response.status).toBe(httpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe(errorCodes.EMAIL_NOT_VERIFIED);
    });

    it('should successfully log in after user email is verified', async () => {
      // Mark email verified in DB
      await db('users').where({ email: 'login@example.com' }).update({ email_verified: true });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctpassword123',
        });

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user).toMatchObject({
        name: 'Login User',
        email: 'login@example.com',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject login with incorrect password', async () => {
      await db('users').where({ email: 'login@example.com' }).update({ email_verified: true });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
    });

    it('should return 429 Too Many Requests on the 6th consecutive attempt with wrong credentials', async () => {
      resetRateLimiters();
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'login@example.com',
            password: 'wrongpassword',
          });
        expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      }

      const limitedResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(limitedResponse.status).toBe(httpStatus.TOO_MANY_REQUESTS);
      expect(limitedResponse.body.error.code).toBe(errorCodes.RATE_LIMITED);
    });
  });

  describe('GET /auth/verify-email', () => {
    let rawToken: string;

    beforeEach(async () => {
      vi.mocked(sendVerificationEmail).mockClear();
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'Verify User',
          email: 'verify@example.com',
          password: 'password123',
        });

      // Extract raw token passed to sendVerificationEmail
      const call = vi.mocked(sendVerificationEmail).mock.calls[0];
      const link = call[1];
      rawToken = link.split('token=')[1];
    });

    it('should verify email with valid token and allow login afterwards', async () => {
      const response = await request(app).get(`/auth/verify-email?token=${rawToken}`);

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Email verified successfully');

      // Verify user in DB
      const user = await db('users').where({ email: 'verify@example.com' }).first();
      expect(Boolean(user.email_verified)).toBe(true);

      // Verify token marked used
      const tokenInDb = await db('email_verification_tokens').where({ user_id: user.id }).first();
      expect(tokenInDb.used_at).not.toBeNull();

      // Now login should succeed
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'verify@example.com',
          password: 'password123',
        });

      expect(loginRes.status).toBe(httpStatus.OK);
      expect(loginRes.body.data).toHaveProperty('accessToken');
    });

    it('should reject verification with invalid token', async () => {
      const response = await request(app).get('/auth/verify-email?token=invalid_token_value');

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(errorCodes.EMAIL_VERIFICATION_INVALID);
    });

    it('should reject verification when token is already used', async () => {
      // First verification succeeds
      await request(app).get(`/auth/verify-email?token=${rawToken}`);

      // Second verification attempt fails
      const response = await request(app).get(`/auth/verify-email?token=${rawToken}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(errorCodes.EMAIL_VERIFICATION_INVALID);
    });
  });

  describe('POST /auth/resend-verification', () => {
    beforeEach(async () => {
      vi.mocked(sendVerificationEmail).mockClear();
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'Resend User',
          email: 'resend@example.com',
          password: 'password123',
        });
    });

    it('should invalidate existing token and issue a new usable verification token for unverified user', async () => {
      vi.mocked(sendVerificationEmail).mockClear();

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'resend@example.com' });

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);

      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
      const call = vi.mocked(sendVerificationEmail).mock.calls[0];
      const newRawToken = call[1].split('token=')[1];

      // New token should work for email verification
      const verifyRes = await request(app).get(`/auth/verify-email?token=${newRawToken}`);
      expect(verifyRes.status).toBe(httpStatus.OK);
    });

    it('should return generic message without sending email if user is already verified', async () => {
      await db('users').where({ email: 'resend@example.com' }).update({ email_verified: true });
      vi.mocked(sendVerificationEmail).mockClear();

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'resend@example.com' });

      expect(response.status).toBe(httpStatus.OK);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('Protected Route & Auth Middleware', () => {
    let validToken: string;

    beforeEach(async () => {
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'Protected User',
          email: 'protected@example.com',
          password: 'password123',
        });

      await db('users').where({ email: 'protected@example.com' }).update({ email_verified: true });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'protected@example.com',
          password: 'password123',
        });
      validToken = loginRes.body.data.accessToken;
    });

    it('should allow access with valid bearer access token', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
    });

    it('should reject access when Authorization header is missing', async () => {
      const response = await request(testApp).get('/protected');

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });
  });

  describe('POST /auth/refresh & POST /auth/logout', () => {
    it('should rotate refresh token and issue new access token on refresh', async () => {
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'Refresh User',
          email: 'refresh@example.com',
          password: 'password123',
        });

      await db('users').where({ email: 'refresh@example.com' }).update({ email_verified: true });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'password123',
        });

      const rawCookie = loginRes.headers['set-cookie'][0];
      const cookieValue = rawCookie.split(';')[0];

      // Refresh token request
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [cookieValue]);

      expect(refreshRes.status).toBe(httpStatus.OK);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');

      // Old refresh token should now be revoked and rejected
      const replayRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [cookieValue]);

      expect(replayRes.status).toBe(httpStatus.UNAUTHORIZED);
    });
  });

  describe('2FA (TOTP) Full Lifecycle & Security Integration Tests', () => {
    it('should run full 2FA lifecycle and verify security isolation of challengeToken', async () => {
      // 1. Register & verify user
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'TOTP User',
          email: 'totp@example.com',
          password: 'password123',
        });
      await db('users').where({ email: 'totp@example.com' }).update({ email_verified: true });

      // Initial login to get access token for setup
      const initialLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'totp@example.com', password: 'password123' });
      const userAccessToken = initialLoginRes.body.data.accessToken;

      // 2. Setup 2FA
      const setupRes = await request(app)
        .post('/auth/2fa/setup')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(setupRes.status).toBe(httpStatus.OK);
      expect(setupRes.body.data).toHaveProperty('qrCodeDataUrl');
      expect(setupRes.body.data).toHaveProperty('secret');
      const secret = setupRes.body.data.secret;

      // 3. Enable 2FA with valid TOTP code
      const validCode = generateSync({ secret });
      const enableRes = await request(app)
        .post('/auth/2fa/enable')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ code: validCode });

      expect(enableRes.status).toBe(httpStatus.OK);
      expect(enableRes.body.data.message).toMatch(/enabled successfully/i);

      // 4. Login after 2FA enabled -> should return challengeToken, NO refresh cookie, NO access token
      const mfaLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'totp@example.com', password: 'password123' });

      expect(mfaLoginRes.status).toBe(httpStatus.OK);
      expect(mfaLoginRes.body.data.requiresTwoFactor).toBe(true);
      expect(mfaLoginRes.body.data).toHaveProperty('challengeToken');
      expect(mfaLoginRes.body.data).not.toHaveProperty('accessToken');
      expect(mfaLoginRes.headers['set-cookie']).toBeUndefined();

      const challengeToken = mfaLoginRes.body.data.challengeToken;

      // 5. SECURITY PROOF TEST: Ensure challengeToken is REJECTED by authenticate middleware on protected routes
      const unauthorizedBearerRes = await request(testApp)
        .get('/protected')
        .set('Authorization', `Bearer ${challengeToken}`);

      expect(unauthorizedBearerRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(unauthorizedBearerRes.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);

      // 6. Verify-login with wrong TOTP code -> 401
      resetRateLimiters();
      const wrongVerifyRes = await request(app)
        .post('/auth/2fa/verify-login')
        .send({ challengeToken, code: '000000' });

      expect(wrongVerifyRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(wrongVerifyRes.body.error).toEqual({
        code: 'MFA_CODE_INVALID',
        message: 'Invalid verification code',
      });

      // 7. Verify-login with correct TOTP code -> 200 + tokens + refresh cookie
      const currentValidCode = generateSync({ secret });
      const correctVerifyRes = await request(app)
        .post('/auth/2fa/verify-login')
        .send({ challengeToken, code: currentValidCode });

      expect(correctVerifyRes.status).toBe(httpStatus.OK);
      expect(correctVerifyRes.body.data).toHaveProperty('accessToken');
      expect(correctVerifyRes.body.data.user).toHaveProperty('email', 'totp@example.com');
      expect(correctVerifyRes.headers['set-cookie']).toBeDefined();

      const authenticatedAccessToken = correctVerifyRes.body.data.accessToken;

      // 8. Disable 2FA with valid TOTP code
      const disableCode = generateSync({ secret });
      const disableRes = await request(app)
        .post('/auth/2fa/disable')
        .set('Authorization', `Bearer ${authenticatedAccessToken}`)
        .send({ code: disableCode });

      expect(disableRes.status).toBe(httpStatus.OK);
      expect(disableRes.body.data.message).toMatch(/disabled successfully/i);

      // 9. Login again -> normal login without 2FA prompt
      const postDisableLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'totp@example.com', password: 'password123' });

      expect(postDisableLoginRes.status).toBe(httpStatus.OK);
      expect(postDisableLoginRes.body.data).toHaveProperty('accessToken');
      expect(postDisableLoginRes.body.data.requiresTwoFactor).not.toBe(true);
    });
  });
});
