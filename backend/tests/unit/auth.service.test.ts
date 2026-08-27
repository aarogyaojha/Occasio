import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../src/modules/auth/auth.service';
import { authRepository, User, RefreshToken } from '../../src/modules/auth/auth.repository';
import { AppError } from '../../src/utils/AppError';
import { httpStatus, errorCodes, ACCESS_TOKEN_EXPIRY } from '../../src/constants';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

vi.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createUser: vi.fn(),
    storeRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
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
    password_hash: 'hashed_password_abc123',
    created_at: new Date('2026-08-01'),
  };

  const mockRefreshToken: RefreshToken = {
    id: 1,
    user_id: 1,
    token_hash: 'mock_token_hash',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked_at: null,
  };

  describe('signup', () => {
    it('throws AUTH_EMAIL_TAKEN (400) when email is already registered', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);

      await expect(
        authService.signup({
          name: 'Alice Smith',
          email: 'alice@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError);

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(authRepository.createUser).not.toHaveBeenCalled();
    });

    it('hashes password and creates user when email is available', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(undefined);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_pwd_xyz' as never);
      vi.mocked(authRepository.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.sign).mockReturnValue('mock_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue(mockRefreshToken);

      const result = await authService.signup({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'Password123!',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(authRepository.createUser).toHaveBeenCalledWith({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password_hash: 'hashed_pwd_xyz',
      });
      expect(authRepository.storeRefreshToken).toHaveBeenCalledTimes(1);
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.accessToken).toBe('mock_access_token');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  describe('login', () => {
    it('throws AUTH_INVALID_CREDENTIALS (401) when user email is not found', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(undefined);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError);

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws AUTH_INVALID_CREDENTIALS (401) when password comparison fails', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.login({
          email: 'alice@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrowError(AppError);

      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword', mockUser.password_hash);
    });

    it('authenticates user and returns tokens on valid credentials', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('login_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue(mockRefreshToken);

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
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked_at: null,
    };

    it('throws AUTH_TOKEN_INVALID (401) when refresh token is missing', async () => {
      await expect(authService.refresh(undefined)).rejects.toThrowError(AppError);
    });

    it('throws AUTH_TOKEN_INVALID (401) when token is not found in repository', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(undefined);

      await expect(authService.refresh('invalid_raw_token')).rejects.toThrowError(AppError);
    });

    it('rotates refresh token: revokes old token BEFORE storing new token and returning new pair', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(activeStoredToken);
      vi.mocked(authRepository.revokeRefreshToken).mockResolvedValue();
      vi.mocked(jwt.sign).mockReturnValue('new_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue(mockRefreshToken);

      const callOrder: string[] = [];
      vi.mocked(authRepository.revokeRefreshToken).mockImplementation(async () => {
        callOrder.push('revokeRefreshToken');
      });
      vi.mocked(authRepository.storeRefreshToken).mockImplementation(async () => {
        callOrder.push('storeRefreshToken');
        return mockRefreshToken;
      });

      const result = await authService.refresh('valid_raw_token');

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
      };
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValue(revokedToken);

      await authService.logout('raw_token');

      expect(authRepository.findRefreshTokenByHash).toHaveBeenCalled();
      expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('throws NOT_FOUND (404) if user is not found', async () => {
      vi.mocked(authRepository.findUserById).mockResolvedValue(undefined);

      await expect(authService.getCurrentUser(999)).rejects.toThrowError(AppError);
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
      });
    });
  });
});
