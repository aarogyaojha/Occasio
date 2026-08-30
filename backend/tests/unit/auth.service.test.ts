import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSecret } from 'otplib';
import { authService } from '../../src/modules/auth/auth.service';
import { authRepository, User, RefreshToken, EmailVerificationToken } from '../../src/modules/auth/auth.repository';
import { sendVerificationEmail } from '../../src/utils/sendVerificationEmail';
import { AppError } from '../../src/utils/AppError';
import { httpStatus, errorCodes, ACCESS_TOKEN_EXPIRY } from '../../src/constants';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

vi.mock('../../src/utils/sendVerificationEmail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createUser: vi.fn(),
    storeRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
    createVerificationToken: vi.fn(),
    findVerificationTokenByHash: vi.fn(),
    markVerificationTokenUsed: vi.fn(),
    markUserEmailVerified: vi.fn(),
    invalidateUserVerificationTokens: vi.fn(),
    updateUserTotpSecret: vi.fn(),
    setUserTotpEnabled: vi.fn(),
    clearUserTotp: vi.fn(),
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
    verify: vi.fn(),
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
    email_verified: false,
    totp_secret: null,
    totp_enabled: false,
    created_at: new Date('2026-08-01'),
  };

  const mockVerifiedUser: User = {
    ...mockUser,
    email_verified: true,
  };

  const mockRefreshToken: RefreshToken = {
    id: 1,
    user_id: 1,
    token_hash: 'mock_token_hash',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked_at: null,
  };

  const mockVerificationToken: EmailVerificationToken = {
    id: 10,
    user_id: 1,
    token_hash: 'hashed_verification_token',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used_at: null,
  };

  describe('signup', () => {
    it('throws AUTH_EMAIL_TAKEN (409) when email is already registered', async () => {
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

    it('hashes password, creates user, creates verification token, sends email, and returns user without tokens', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(undefined);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_pwd_xyz' as never);
      vi.mocked(authRepository.createUser).mockResolvedValue(mockUser);
      vi.mocked(authRepository.createVerificationToken).mockResolvedValue(mockVerificationToken);

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
      expect(authRepository.createVerificationToken).toHaveBeenCalledWith({
        user_id: mockUser.id,
        token_hash: expect.any(String),
        expires_at: expect.any(Date),
      });
      expect(sendVerificationEmail).toHaveBeenCalledWith('alice@example.com', expect.stringContaining('/verify-email?token='));
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.user.email_verified).toBe(false);
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
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

    it('throws EMAIL_NOT_VERIFIED (403) when user email is not verified', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(
        authService.login({
          email: 'alice@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: httpStatus.FORBIDDEN,
          code: errorCodes.EMAIL_NOT_VERIFIED,
        })
      );
    });

    it('authenticates user and returns tokens when email is verified and credentials valid', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockVerifiedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('login_access_token' as any);
      vi.mocked(authRepository.storeRefreshToken).mockResolvedValue(mockRefreshToken);

      const result = await authService.login({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', mockVerifiedUser.password_hash);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockVerifiedUser.id },
        expect.any(String),
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );
      expect(authRepository.storeRefreshToken).toHaveBeenCalledTimes(1);
      expect(result.requiresTwoFactor).toBe(false);
      if (!result.requiresTwoFactor) {
        expect(result.user).not.toHaveProperty('password_hash');
        expect(result.accessToken).toBe('login_access_token');
      }
    });
  });

  describe('verifyEmail', () => {
    it('marks user email verified and token as used when valid token is provided', async () => {
      vi.mocked(authRepository.findVerificationTokenByHash).mockResolvedValue(mockVerificationToken);
      vi.mocked(authRepository.markUserEmailVerified).mockResolvedValue();
      vi.mocked(authRepository.markVerificationTokenUsed).mockResolvedValue();

      const result = await authService.verifyEmail('valid_raw_token');

      expect(authRepository.markUserEmailVerified).toHaveBeenCalledWith(mockVerificationToken.user_id);
      expect(authRepository.markVerificationTokenUsed).toHaveBeenCalledWith(mockVerificationToken.id);
      expect(result.message).toBe('Email verified successfully');
    });

    it('throws EMAIL_VERIFICATION_INVALID (400) if token is not found', async () => {
      vi.mocked(authRepository.findVerificationTokenByHash).mockResolvedValue(undefined);

      await expect(authService.verifyEmail('nonexistent_token')).rejects.toThrowError(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          code: errorCodes.EMAIL_VERIFICATION_INVALID,
        })
      );
    });

    it('throws EMAIL_VERIFICATION_INVALID (400) if token is already used', async () => {
      const usedToken: EmailVerificationToken = {
        ...mockVerificationToken,
        used_at: new Date(),
      };
      vi.mocked(authRepository.findVerificationTokenByHash).mockResolvedValue(usedToken);

      await expect(authService.verifyEmail('already_used_token')).rejects.toThrowError(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          code: errorCodes.EMAIL_VERIFICATION_INVALID,
        })
      );
    });

    it('throws EMAIL_VERIFICATION_INVALID (400) if token is expired', async () => {
      const expiredToken: EmailVerificationToken = {
        ...mockVerificationToken,
        expires_at: new Date(Date.now() - 1000),
      };
      vi.mocked(authRepository.findVerificationTokenByHash).mockResolvedValue(expiredToken);

      await expect(authService.verifyEmail('expired_token')).rejects.toThrowError(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          code: errorCodes.EMAIL_VERIFICATION_INVALID,
        })
      );
    });
  });

  describe('resendVerification', () => {
    it('invalidates existing tokens and sends new token if user exists and is unverified', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(authRepository.invalidateUserVerificationTokens).mockResolvedValue();
      vi.mocked(authRepository.createVerificationToken).mockResolvedValue(mockVerificationToken);

      const result = await authService.resendVerification('alice@example.com');

      expect(authRepository.invalidateUserVerificationTokens).toHaveBeenCalledWith(mockUser.id);
      expect(authRepository.createVerificationToken).toHaveBeenCalledWith({
        user_id: mockUser.id,
        token_hash: expect.any(String),
        expires_at: expect.any(Date),
      });
      expect(sendVerificationEmail).toHaveBeenCalledWith('alice@example.com', expect.stringContaining('/verify-email?token='));
      expect(result.message).toContain('Verification email sent');
    });

    it('returns generic message without sending email if user is already verified', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockVerifiedUser);

      const result = await authService.resendVerification('alice@example.com');

      expect(authRepository.invalidateUserVerificationTokens).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('Verification email sent');
    });

    it('returns generic message without sending email if user does not exist', async () => {
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(undefined);

      const result = await authService.resendVerification('unknown@example.com');

      expect(authRepository.invalidateUserVerificationTokens).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('Verification email sent');
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
      expect(result).not.toHaveProperty('totp_secret');
      expect(result).toEqual({
        id: 1,
        name: 'Alice Smith',
        email: 'alice@example.com',
        email_verified: false,
        totp_enabled: false,
        created_at: mockUser.created_at,
      });
    });
  });

  describe('2FA Service Methods (Unit)', () => {
    it('login returns challengeToken when totp_enabled is true', async () => {
      const mockMfaUser: User = {
        ...mockVerifiedUser,
        totp_secret: 'JBSWY3DPEHPK3PXP',
        totp_enabled: true,
      };
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(mockMfaUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('mfa_challenge_jwt_123' as any);

      const result = await authService.login({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      expect(result).toEqual({
        requiresTwoFactor: true,
        challengeToken: 'mfa_challenge_jwt_123',
      });
      expect(authRepository.storeRefreshToken).not.toHaveBeenCalled();
    });

    it('setupTwoFactor updates totp_secret and returns qrCodeDataUrl and secret', async () => {
      vi.mocked(authRepository.findUserById).mockResolvedValue(mockVerifiedUser);
      vi.mocked(authRepository.updateUserTotpSecret).mockResolvedValue();

      const result = await authService.setupTwoFactor(1);

      expect(authRepository.updateUserTotpSecret).toHaveBeenCalledWith(1, expect.any(String));
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('secret');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('enableTwoFactor throws MFA_CODE_INVALID when code is wrong', async () => {
      const mockUserWithSecret: User = {
        ...mockVerifiedUser,
        totp_secret: generateSecret(),
        totp_enabled: false,
      };
      vi.mocked(authRepository.findUserById).mockResolvedValue(mockUserWithSecret);

      await expect(authService.enableTwoFactor(1, '000000')).rejects.toThrowError(AppError);
      expect(authRepository.setUserTotpEnabled).not.toHaveBeenCalled();
    });

    it('disableTwoFactor clears totp on valid code and rejects wrong code', async () => {
      const mockUserMfa: User = {
        ...mockVerifiedUser,
        totp_secret: generateSecret(),
        totp_enabled: true,
      };
      vi.mocked(authRepository.findUserById).mockResolvedValue(mockUserMfa);

      await expect(authService.disableTwoFactor(1, '000000')).rejects.toThrowError(AppError);
      expect(authRepository.clearUserTotp).not.toHaveBeenCalled();
    });

    it('verifyTwoFactorLogin throws MFA_CHALLENGE_INVALID if challenge token is invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        authService.verifyTwoFactorLogin('bad_challenge_token', '123456')
      ).rejects.toThrowError(AppError);
    });
  });
});
