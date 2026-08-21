import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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
    // Reset rate limiter counters and clear tables before each test
    resetRateLimiters();
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
  });

  afterAll(async () => {
    // Cleanup DB connection
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('POST /auth/signup', () => {
    it('should successfully register a new user and set refresh token cookie', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(httpStatus.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user).toMatchObject({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });
      expect(response.body.data.user).not.toHaveProperty('password_hash');

      // Check cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
      expect(cookies[0]).toMatch(/HttpOnly/i);

      // Verify user in DB
      const userInDb = await db('users').where({ email: 'jane@example.com' }).first();
      expect(userInDb).toBeDefined();
      expect(userInDb.name).toBe('Jane Doe');
      expect(userInDb.password_hash).not.toBe('password123'); // Password must be hashed
    });

    it('should reject signup with duplicate email', async () => {
      // First signup
      await request(app)
        .post('/auth/signup')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      // Second signup with same email
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
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
          }),
        ])
      );
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

    it('should successfully log in with valid credentials and return access token', async () => {
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
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
    });

    it('should reject login for non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'correctpassword123',
        });

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
    });

    it('should return 429 Too Many Requests on the 6th consecutive attempt with wrong credentials', async () => {
      resetRateLimiters();
      // First 5 attempts with wrong credentials return 401 Unauthorized
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'login@example.com',
            password: 'wrongpassword',
          });
        expect(response.status).toBe(httpStatus.UNAUTHORIZED);
        expect(response.body.error.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
      }

      // 6th attempt returns 429 TOO_MANY_REQUESTS with standard error envelope shape
      const limitedResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(limitedResponse.status).toBe(httpStatus.TOO_MANY_REQUESTS);
      expect(limitedResponse.body).toEqual({
        error: {
          code: errorCodes.RATE_LIMITED,
          message: errorMessages[errorCodes.RATE_LIMITED],
        },
      });
    });
  });

  describe('Protected Route & Auth Middleware', () => {
    let validToken: string;

    beforeEach(async () => {
      const signupRes = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Protected User',
          email: 'protected@example.com',
          password: 'password123',
        });
      validToken = signupRes.body.data.accessToken;
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

    it('should reject access when token is invalid or malformed', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });
  });

  describe('POST /auth/refresh & POST /auth/logout', () => {
    it('should rotate refresh token and issue new access token on refresh', async () => {
      const signupRes = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Refresh User',
          email: 'refresh@example.com',
          password: 'password123',
        });

      const rawCookie = signupRes.headers['set-cookie'][0];
      const cookieValue = rawCookie.split(';')[0];

      // Refresh token request
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [cookieValue]);

      expect(refreshRes.status).toBe(httpStatus.OK);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.headers['set-cookie']).toBeDefined();

      // Old refresh token should now be revoked and rejected
      const replayRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [cookieValue]);

      expect(replayRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(replayRes.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });

    it('should revoke token on logout', async () => {
      const signupRes = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'password123',
        });

      const rawCookie = signupRes.headers['set-cookie'][0];
      const cookieValue = rawCookie.split(';')[0];

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Cookie', [cookieValue]);

      expect(logoutRes.status).toBe(httpStatus.OK);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.data.message).toBe('Logged out successfully');

      // Attempting to refresh after logout should fail
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [cookieValue]);

      expect(refreshRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(refreshRes.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile when authenticated', async () => {
      const signupRes = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'password123',
        });

      const token = signupRes.body.data.accessToken;

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(httpStatus.OK);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data).toMatchObject({
        name: 'Me User',
        email: 'me@example.com',
      });
      expect(meRes.body.data).not.toHaveProperty('password_hash');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });
  });
});
