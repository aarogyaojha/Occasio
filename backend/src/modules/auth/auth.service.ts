import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authRepository, User } from './auth.repository';
import { SignupInput, LoginInput } from './auth.schema';
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
   * Registers a new user, hashes their password, and creates an access and refresh token pair.
   *
   * @param input - The signup input containing name, email, and password.
   * @returns An object containing the created user (without password), access token, and raw refresh token.
   * @throws AppError 409 if the email is already registered.
   */
  async signup(input: SignupInput): Promise<{
    user: Omit<User, 'password_hash'>;
    accessToken: string;
    refreshToken: string;
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
   * Authenticates user credentials and creates a new access and refresh token pair.
   *
   * @param input - The login input containing email and password.
   * @returns An object containing user details, access token, and raw refresh token.
   * @throws AppError 401 if the email or password is invalid.
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
};
