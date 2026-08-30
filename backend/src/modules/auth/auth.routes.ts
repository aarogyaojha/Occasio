import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authLimiter } from '../../middleware/rateLimiter.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
  signupSchema,
  loginSchema,
  verifyEmailQuerySchema,
  resendVerificationSchema,
  enableTwoFactorSchema,
  disableTwoFactorSchema,
  verifyTwoFactorLoginSchema,
} from './auth.schema';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user (email verification required)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully (verification email sent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         email_verified:
 *                           type: boolean
 *                           example: false
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                     message:
 *                       type: string
 *                       example: Verification email sent — check your inbox.
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 *       429:
 *         description: Too many requests
 */
router.post('/signup', authLimiter, validate(signupSchema), asyncHandler(authController.signup));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Email not verified (EMAIL_NOT_VERIFIED)
 *       429:
 *         description: Too many requests
 */
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify user email address via token
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired verification token (EMAIL_VERIFICATION_INVALID)
 */
router.get(
  '/verify-email',
  validate(verifyEmailQuerySchema, 'query'),
  asyncHandler(authController.verifyEmail)
);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend email verification link
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       200:
 *         description: Verification email request processed
 *       429:
 *         description: Too many requests
 */
router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  asyncHandler(authController.resendVerification)
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Successfully refreshed token
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', authLimiter, asyncHandler(authController.refresh));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out user and revoke refresh token
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', asyncHandler(authController.logout));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, asyncHandler(authController.me));

/**
 * @swagger
 * /auth/2fa/setup:
 *   post:
 *     summary: Initiate setup for TOTP-based two-factor authentication, compatible with any standard authenticator app
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Generated secret and QR code data URL
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post('/2fa/setup', authenticate, authLimiter, asyncHandler(authController.setupTwoFactor));

/**
 * @swagger
 * /auth/2fa/enable:
 *   post:
 *     summary: Verify TOTP code and enable TOTP-based two-factor authentication, compatible with any standard authenticator app
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *       400:
 *         description: Invalid verification code (MFA_CODE_INVALID)
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post(
  '/2fa/enable',
  authenticate,
  authLimiter,
  validate(enableTwoFactorSchema),
  asyncHandler(authController.enableTwoFactor)
);

/**
 * @swagger
 * /auth/2fa/disable:
 *   post:
 *     summary: Disable TOTP-based two-factor authentication with valid TOTP code
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *       400:
 *         description: Invalid verification code (MFA_CODE_INVALID)
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post(
  '/2fa/disable',
  authenticate,
  authLimiter,
  validate(disableTwoFactorSchema),
  asyncHandler(authController.disableTwoFactor)
);

/**
 * @swagger
 * /auth/2fa/verify-login:
 *   post:
 *     summary: Verify 2FA challenge token and TOTP code to complete login
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - challengeToken
 *               - code
 *             properties:
 *               challengeToken:
 *                 type: string
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Successfully authenticated with 2FA
 *       401:
 *         description: Invalid verification code or challenge token
 *       429:
 *         description: Too many requests
 */
router.post(
  '/2fa/verify-login',
  authLimiter,
  validate(verifyTwoFactorLoginSchema),
  asyncHandler(authController.verifyTwoFactorLogin)
);

export default router;
