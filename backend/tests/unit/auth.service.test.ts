import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../src/modules/auth/auth.service';
import { authRepository, User, RefreshToken } from '../../src/modules/auth/auth.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../../src/utils/AppError';
import {
  httpStatus,
  errorCodes,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../../src/constants';

vi.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
    storeRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
    findUserById: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}));

describe('Auth Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser: User = {
    id: 1,
    name: 'Alice Smith',
    email: 'alice@example.com',
    password_hash: 'hashed_password_123',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  describe('signup', () => {
    it('throws AUTH_EMAIL_TAKEN (409) if email is already registered', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);

      await expect(
        authService.signup({ name: 'Alice', email: 'alice@example.com', password: 'Password123!' })
      ).rejects.toThrowError(AppError);

      try {
        await authService.signup({ name: 'Alice', email: 'alice@example.com', password: 'Password123!' });
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.CONFLICT);
        expect(err.code).toBe(errorCodes.AUTH_EMAIL_TAKEN);
      }
    });

    it('hashes password with 10 salt rounds and creates user when email is available', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password_123' as never);
      vi.mocked(authRepository.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.sign).mockReturnValue('mock_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue();

      const result = await authService.signup({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'Password123!',
      });

      // Verify password hashing salt rounds
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);

      // Verify user creation
      expect(authRepository.createUser).toHaveBeenCalledWith({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password_hash: 'hashed_password_123',
      });

      // Verify token generation uses ACCESS_TOKEN_EXPIRY constant
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUser.id },
        expect.any(String),
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      // Verify refresh token storage and expiry calculation
      expect(authRepository.storeRefreshToken).toHaveBeenCalledWith({
        user_id: mockUser.id,
        token_hash: expect.any(String),
        expires_at: expect.any(Date),
      });

      const storeCall = vi.mocked(authRepository.storeRefreshToken).mock.calls[0][0];
      const expiryDifferenceMs = storeCall.expires_at.getTime() - Date.now();
      const expectedMs = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiryDifferenceMs - expectedMs)).toBeLessThan(5000);

      // Verify result excludes password_hash
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.user).toEqual({
        id: 1,
        name: 'Alice Smith',
        email: 'alice@example.com',
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(result.accessToken).toBe('mock_access_token');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  describe('login', () => {
    it('throws AUTH_INVALID_CREDENTIALS (401) if email is not found', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nonexistent@example.com', password: 'Password123!' })
      ).rejects.toThrowError(AppError);

      try {
        await authService.login({ email: 'nonexistent@example.com', password: 'Password123!' });
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
      }
    });

    it('rejects on wrong password (mocked bcrypt.compare returning false)', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.login({ email: 'alice@example.com', password: 'WrongPassword' })
      ).rejects.toThrowError(AppError);

      try {
        await authService.login({ email: 'alice@example.com', password: 'WrongPassword' });
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_INVALID_CREDENTIALS);
      }

      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword', mockUser.password_hash);
    });

    it('authenticates user and returns tokens on valid credentials', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('login_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue();

      const result = await authService.login({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', mockUser.password_hash);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUser.id },
        expect.any(String),
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );
      expect(authRepository.storeRefreshToken).toHaveBeenCalledTimes(1);
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.accessToken).toBe('login_access_token');
    });
  });

  describe('refresh', () => {
    const activeStoredToken: RefreshToken = {
      id: 100,
      user_id: 1,
      token_hash: 'some_hash',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // future
      revoked_at: null,
      created_at: new Date(),
    };

    it('throws AUTH_TOKEN_INVALID (401) when refresh token is missing', async () => {
      await expect(authService.refresh(undefined)).rejects.toThrowError(AppError);
      try {
        await authService.refresh(undefined);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
      }
    });

    it('throws AUTH_TOKEN_INVALID (401) when token is not found in repository', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(null);

      await expect(authService.refresh('invalid_raw_token')).rejects.toThrowError(AppError);
      try {
        await authService.refresh('invalid_raw_token');
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
      }
    });

    it('throws AUTH_TOKEN_INVALID (401) when token is revoked', async () => {
      const revokedToken: RefreshToken = {
        ...activeStoredToken,
        revoked_at: new Date('2026-08-01'),
      };
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(revokedToken);

      await expect(authService.refresh('revoked_raw_token')).rejects.toThrowError(AppError);
      try {
        await authService.refresh('revoked_raw_token');
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
      }
    });

    it('throws AUTH_TOKEN_EXPIRED (401) when token is expired', async () => {
      const expiredToken: RefreshToken = {
        ...activeStoredToken,
        expires_at: new Date(Date.now() - 10000), // past
      };
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(expiredToken);

      await expect(authService.refresh('expired_raw_token')).rejects.toThrowError(AppError);
      try {
        await authService.refresh('expired_raw_token');
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.UNAUTHORIZED);
        expect(err.code).toBe(errorCodes.AUTH_TOKEN_EXPIRED);
      }
    });

    it('rotates refresh token: revokes old token BEFORE storing new token and returning new pair', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(activeStoredToken);
      vi.mocked(authRepository.revokeRefreshToken).mockResolvedValue();
      vi.mocked(jwt.sign).mockReturnValue('new_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue();

      const callOrder: string[] = [];
      vi.mocked(authRepository.revokeRefreshToken).mockImplementation(async () => {
        callOrder.push('revokeRefreshToken');
      });
      vi.mocked(authRepository.storeRefreshToken).mockImplementation(async () => {
        callOrder.push('storeRefreshToken');
      });

      const result = await authService.refresh('valid_raw_token');

      // Verify token rotation sequence
      expect(callOrder).toEqual(['revokeRefreshToken', 'storeRefreshToken']);
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(activeStoredToken.id);
      expect(authRepository.storeRefreshToken).toHaveBeenCalledWith({
        user_id: activeStoredToken.user_id,
        token_hash: expect.any(String),
        expires_at: expect.any(Date),
      });

      expect(result.accessToken).toBe('new_access_token');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  describe('logout', () => {
    it('does nothing when rawRefreshToken is undefined', async () => {
      await authService.logout(undefined);
      expect(authRepository.findRefreshTokenByHash).not.toHaveBeenCalled();
      expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('revokes an active refresh token on logout', async () => {
      const activeToken: RefreshToken = {
        id: 50,
        user_id: 1,
        token_hash: 'hash',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: null,
        created_at: new Date(),
      };
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(activeToken);
      vi.mocked(authRepository.revokeRefreshToken).mockResolvedValue();

      await authService.logout('raw_token');

      expect(authRepository.findRefreshTokenByHash).toHaveBeenCalled();
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(50);
    });

    it('does not attempt to revoke if token is already revoked', async () => {
      const revokedToken: RefreshToken = {
        id: 50,
        user_id: 1,
        token_hash: 'hash',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: new Date(),
        created_at: new Date(),
      };
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(revokedToken);

      await authService.logout('raw_token');

      expect(authRepository.findRefreshTokenByHash).toHaveBeenCalled();
      expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('throws NOT_FOUND (404) if user is not found', async () => {
      vi.mocked(authRepository.findUserById).mockResolvedValue(null);

      await expect(authService.getCurrentUser(999)).rejects.toThrowError(AppError);
      try {
        await authService.getCurrentUser(999);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
        expect(err.code).toBe(errorCodes.NOT_FOUND);
      }
    });

    it('returns user without password_hash if found', async () => {
      vi.mocked(authRepository.findUserById).mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(1);

      expect(result).not.toHaveProperty('password_hash');
      expect(result).toEqual({
        id: 1,
        name: 'Alice Smith',
        email: 'alice@example.com',
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });
  });
});
