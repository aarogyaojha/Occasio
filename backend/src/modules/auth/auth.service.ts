import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
    user: Omit<User, 'password_hash'>;
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

    const { password_hash, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      message: 'Verification email sent — check your inbox.',
    };
  },

  /**
   * Authenticates user credentials. Blocks login if email is not verified.
   *
   * @param input - The login input containing email and password.
   * @returns An object containing user details, access token, and raw refresh token.
   * @throws AppError 401 if credentials are invalid.
   * @throws AppError 403 if email is not verified.
   */
  async login(input: LoginInput): Promise<{
    user: Omit<User, 'password_hash'>;
    accessToken: string;
    refreshToken: string;
  }> {
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

    const accessToken = generateAccessToken(user.id);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.storeRefreshToken({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const { password_hash, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
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
   * Retrieves details for the currently authenticated user by ID (omitting password hash).
   *
   * @param userId - Primary key ID of the user.
   * @returns The user object without password_hash.
   * @throws AppError 404 if user not found.
   */
  async getCurrentUser(userId: number): Promise<Omit<User, 'password_hash'>> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.NOT_FOUND],
        errorCodes.NOT_FOUND
      );
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};
