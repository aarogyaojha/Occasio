import { Request, Response, NextFunction } from 'express';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { AppError } from '../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../constants';
import { isDevelopment } from '../config/env';

const authStore = new MemoryStore();
const generalStore = new MemoryStore();

/**
 * Custom rate limit handler that integrates with the central error handling middleware
 * by forwarding an AppError with the standard envelope format and RATE_LIMITED code.
 */
const rateLimitHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(
    new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      errorMessages[errorCodes.RATE_LIMITED],
      errorCodes.RATE_LIMITED
    )
  );
};

/**
 * Strict rate limiter for sensitive authentication endpoints (signup, login, refresh).
 * Limits requests to 5 per 15-minute window per IP in production, higher in development.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: authStore,
  handler: rateLimitHandler,
});

/**
 * General rate limiter for standard CRUD and public endpoints.
 * Limits requests to 100 per 15-minute window per IP.
 * Skips Swagger UI documentation (/api-docs) and routes protected by authLimiter.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: generalStore,
  skip: (req) => {
    const url = req.originalUrl || req.baseUrl + req.path;
    // Skip Swagger docs
    if (url.startsWith('/api-docs')) {
      return true;
    }
    // Prevent stacking on sensitive auth endpoints that use authLimiter
    if (
      url.startsWith('/auth/signup') ||
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/refresh')
    ) {
      return true;
    }
    return false;
  },
  handler: rateLimitHandler,
});

/**
 * Resets the in-memory rate limiter stores.
 * Intended for use in test environments to ensure test isolation.
 */
export const resetRateLimiters = (): void => {
  authStore.resetAll();
  generalStore.resetAll();
};
