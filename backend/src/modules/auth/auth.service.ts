import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { authRepository, User } from './auth.repository';
import { SignupInput, LoginInput } from './auth.schema';
import { sendVerificationEmail } from '../../utils/sendVerificationEmail';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import {
  httpStatus,
  errorCodes,
  errorMessages,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../../constants';

const BCRYPT_SALT_ROUNDS = 10;

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateAccessToken = (userId: number): string => {
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const sanitizeUser = (user: User): Omit<User, 'password_hash' | 'totp_secret'> => {
  const { password_hash, totp_secret, ...rest } = user;
  return rest;
};

export type LoginResult =
  | {
      requiresTwoFactor: true;
      challengeToken: string;
    }
  | {
      requiresTwoFactor?: false;
      user: Omit<User, 'password_hash' | 'totp_secret'>;
      accessToken: string;
      refreshToken: string;
    };

export const authService = {
  /**
   * Registers a new user with unverified email, generates verification token,
   * logs and sends verification email, and returns user details without auth tokens.
   *
   * @param input - The signup input containing name, email, and password.
   * @returns An object containing the created user (without password) and a message.
   * @throws AppError 409 if the email is already registered.
   */
  async signup(input: SignupInput): Promise<{
    user: Omit<User, 'password_hash' | 'totp_secret'>;
    message: string;
  }> {
    const existingUser = await authRepository.findUserByEmail(input.email);
    if (existingUser) {
      throw new AppError(
        httpStatus.CONFLICT,
        errorMessages[errorCodes.AUTH_EMAIL_TAKEN],
        errorCodes.AUTH_EMAIL_TAKEN
      );
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await authRepository.createUser({
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
    });

    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await authRepository.createVerificationToken({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawVerificationToken}`;
    await sendVerificationEmail(user.email, verificationLink);

    return {
      user: sanitizeUser(user),
      message: 'Verification email sent — check your inbox.',
    };
  },

  /**
   * Authenticates user credentials. Blocks login if email is not verified.
   * If TOTP 2FA is enabled, generates a short-lived MFA challenge token instead of session tokens.
   *
   * @param input - The login input containing email and password.
   * @returns An object containing session details or MFA challenge info.
   * @throws AppError 401 if credentials are invalid.
   * @throws AppError 403 if email is not verified.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_INVALID_CREDENTIALS],
        errorCodes.AUTH_INVALID_CREDENTIALS
      );
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_INVALID_CREDENTIALS],
        errorCodes.AUTH_INVALID_CREDENTIALS
      );
    }

    if (!Boolean(user.email_verified)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        errorMessages[errorCodes.EMAIL_NOT_VERIFIED],
        errorCodes.EMAIL_NOT_VERIFIED
      );
    }

    if (Boolean(user.totp_enabled)) {
      const challengeToken = jwt.sign(
        { userId: user.id, type: 'mfa_challenge' },
        env.MFA_CHALLENGE_SECRET,
        { expiresIn: '5m' }
      );
      return {
        requiresTwoFactor: true,
        challengeToken,
      };
    }

    const accessToken = generateAccessToken(user.id);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.storeRefreshToken({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return {
      requiresTwoFactor: false,
      user: sanitizeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },

  /**
   * Verifies a user's email using a raw verification token.
   *
   * @param rawToken - Raw verification token string from query param.
   * @returns Success message object.
   * @throws AppError 400 if token is invalid, expired, or already used.
   */
  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawToken);
    const token = await authRepository.findVerificationTokenByHash(tokenHash);

    if (!token || token.used_at !== null || new Date(token.expires_at) < new Date()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.EMAIL_VERIFICATION_INVALID],
        errorCodes.EMAIL_VERIFICATION_INVALID
      );
    }

    await authRepository.markUserEmailVerified(token.user_id);
    await authRepository.markVerificationTokenUsed(token.id);

    return { message: 'Email verified successfully' };
  },

  /**
   * Resends email verification link to unverified users. Returns generic message regardless.
   *
   * @param email - Target email address.
   * @returns Generic confirmation message.
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const genericMessage = 'Verification email sent — check your inbox.';
    const user = await authRepository.findUserByEmail(email);

    if (user && !Boolean(user.email_verified)) {
      await authRepository.invalidateUserVerificationTokens(user.id);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await authRepository.createVerificationToken({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
      await sendVerificationEmail(user.email, verificationLink);
    }

    return { message: genericMessage };
  },

  /**
   * Validates a raw refresh token, revokes it (token rotation), and issues a new access/refresh token pair.
   *
   * @param rawRefreshToken - The raw refresh token string from cookie or request body.
   * @returns A new pair containing access token and raw refresh token.
   * @throws AppError 401 if the refresh token is missing, invalid, revoked, or expired.
   */
  async refresh(rawRefreshToken?: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!rawRefreshToken) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_INVALID],
        errorCodes.AUTH_TOKEN_INVALID
      );
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_INVALID],
        errorCodes.AUTH_TOKEN_INVALID
      );
    }

    if (storedToken.revoked_at !== null) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_INVALID],
        errorCodes.AUTH_TOKEN_INVALID
      );
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_EXPIRED],
        errorCodes.AUTH_TOKEN_EXPIRED
      );
    }

    // Revoke previous refresh token (rotation)
    await authRepository.revokeRefreshToken(storedToken.id);

    // Issue new pair
    const newAccessToken = generateAccessToken(storedToken.user_id);
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.storeRefreshToken({
      user_id: storedToken.user_id,
      token_hash: newTokenHash,
      expires_at: newExpiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  },

  /**
   * Revokes an active refresh token on user logout.
   *
   * @param rawRefreshToken - The raw refresh token to revoke.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);
    if (storedToken && storedToken.revoked_at === null) {
      await authRepository.revokeRefreshToken(storedToken.id);
    }
  },

  /**
   * Retrieves details for the currently authenticated user by ID (omitting password hash and secret).
   *
   * @param userId - Primary key ID of the user.
   * @returns The user object without password_hash or totp_secret.
   * @throws AppError 404 if user not found.
   */
  async getCurrentUser(userId: number): Promise<Omit<User, 'password_hash' | 'totp_secret'>> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.NOT_FOUND],
        errorCodes.NOT_FOUND
      );
    }

    return sanitizeUser(user);
  },

  /**
   * Generates a TOTP secret and QR code data URL for 2FA setup (unconfirmed).
   *
   * @param userId - Primary key ID of the user.
   * @returns Object with QR code data URL and raw secret key.
   */
  async setupTwoFactor(userId: number): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.NOT_FOUND],
        errorCodes.NOT_FOUND
      );
    }

    const secret = generateSecret();
    await authRepository.updateUserTotpSecret(userId, secret);

    const otpauthUrl = generateURI({ issuer: 'Occasio', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { qrCodeDataUrl, secret };
  },

  /**
   * Verifies the 6-digit TOTP code and enables 2FA for the user.
   *
   * @param userId - Primary key ID of the user.
   * @param code - 6-digit TOTP code.
   * @returns Success confirmation message.
   * @throws AppError 400 if verification code is invalid or setup wasn't initiated.
   */
  async enableTwoFactor(userId: number, code: string): Promise<{ message: string }> {
    const user = await authRepository.findUserById(userId);
    if (!user || !user.totp_secret) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    const result = await verify({ token: code, secret: user.totp_secret });
    if (!result.valid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    await authRepository.setUserTotpEnabled(userId, true);
    return { message: 'Two-factor authentication enabled successfully' };
  },

  /**
   * Verifies the current TOTP code and disables 2FA for the user.
   *
   * @param userId - Primary key ID of the user.
   * @param code - 6-digit TOTP code.
   * @returns Success confirmation message.
   * @throws AppError 400 if verification code is invalid or 2FA is not active.
   */
  async disableTwoFactor(userId: number, code: string): Promise<{ message: string }> {
    const user = await authRepository.findUserById(userId);
    if (!user || !user.totp_secret || !Boolean(user.totp_enabled)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    const result = await verify({ token: code, secret: user.totp_secret });
    if (!result.valid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    await authRepository.clearUserTotp(userId);
    return { message: 'Two-factor authentication disabled successfully' };
  },

  /**
   * Verifies a 2FA challenge token and TOTP code during login, issuing real session tokens.
   *
   * @param challengeToken - Short-lived MFA challenge JWT.
   * @param code - 6-digit TOTP code.
   * @returns User profile, access token, and raw refresh token.
   * @throws AppError 401 if challenge token or TOTP code is invalid.
   */
  async verifyTwoFactorLogin(
    challengeToken: string,
    code: string
  ): Promise<{
    user: Omit<User, 'password_hash' | 'totp_secret'>;
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: { userId?: number; type?: string };
    try {
      payload = jwt.verify(challengeToken, env.MFA_CHALLENGE_SECRET) as {
        userId?: number;
        type?: string;
      };
    } catch {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.MFA_CHALLENGE_INVALID],
        errorCodes.MFA_CHALLENGE_INVALID
      );
    }

    if (payload.type !== 'mfa_challenge' || !payload.userId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.MFA_CHALLENGE_INVALID],
        errorCodes.MFA_CHALLENGE_INVALID
      );
    }

    const user = await authRepository.findUserById(payload.userId);
    if (!user || !user.totp_secret || !Boolean(user.totp_enabled)) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    const result = await verify({ token: code, secret: user.totp_secret });
    if (!result.valid) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.MFA_CODE_INVALID],
        errorCodes.MFA_CODE_INVALID
      );
    }

    const accessToken = generateAccessToken(user.id);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.storeRefreshToken({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },
};
