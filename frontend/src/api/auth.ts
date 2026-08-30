import apiClient from './client';
import type { SignupInput, LoginInput } from '../features/auth/schemas';
import type { User } from '../features/auth/authStore';

export interface SignupResponseData {
  user: User;
  message: string;
}

export type AuthResponseData =
  | {
      requiresTwoFactor: true;
      challengeToken: string;
    }
  | {
      requiresTwoFactor?: false;
      user: User;
      accessToken: string;
    };

export interface SetupTwoFactorResponseData {
  qrCodeDataUrl: string;
  secret: string;
}

export interface RefreshResponseData {
  accessToken: string;
}

export interface MessageResponseData {
  message: string;
}

/**
 * Extracts and throws the backend error payload `{ code, message, details? }`
 * if present on an AxiosError, ensuring UI components can consume `error.message`.
 */
const handleApiError = (error: unknown): never => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { data?: { error?: unknown } } }).response?.data?.error
  ) {
    throw (error as { response: { data: { error: unknown } } }).response.data.error;
  }
  throw error;
};

/**
 * Registers a new user (email verification required).
 */
export const signup = async (data: SignupInput): Promise<SignupResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: SignupResponseData }>(
      '/auth/signup',
      data
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Authenticates user credentials.
 */
export const login = async (data: LoginInput): Promise<AuthResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: AuthResponseData }>(
      '/auth/login',
      data
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Verifies user email with verification token.
 */
export const verifyEmail = async (token: string): Promise<MessageResponseData> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: MessageResponseData }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Resends email verification link to user email address.
 */
export const resendVerification = async (email: string): Promise<MessageResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: MessageResponseData }>(
      '/auth/resend-verification',
      { email }
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

let activeRefreshPromise: Promise<RefreshResponseData> | null = null;

/**
 * Rotates refresh token and issues a new access token.
 * Deduplicated via single-flight Promise to prevent concurrent refresh race conditions.
 */
export const refresh = async (): Promise<RefreshResponseData> => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const response = await apiClient.post<{ success: boolean; data: RefreshResponseData }>(
        '/auth/refresh'
      );
      return response.data.data;
    } catch (error) {
      return handleApiError(error);
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
};

/**
 * Revokes refresh token cookie and logs out.
 */
export const logout = async (): Promise<MessageResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: MessageResponseData }>(
      '/auth/logout'
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Fetches the currently authenticated user profile.
 */
export const getMe = async (): Promise<User> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Initiates TOTP two-factor setup for the authenticated user.
 */
export const setupTwoFactor = async (): Promise<SetupTwoFactorResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: SetupTwoFactorResponseData }>(
      '/auth/2fa/setup'
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Confirms 6-digit TOTP code and enables 2FA.
 */
export const enableTwoFactor = async (code: string): Promise<MessageResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: MessageResponseData }>(
      '/auth/2fa/enable',
      { code }
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Confirms 6-digit TOTP code and disables 2FA.
 */
export const disableTwoFactor = async (code: string): Promise<MessageResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: MessageResponseData }>(
      '/auth/2fa/disable',
      { code }
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Verifies 2FA challenge token and TOTP code to complete login.
 */
export const verifyTwoFactorLogin = async (
  challengeToken: string,
  code: string
): Promise<{ user: User; accessToken: string }> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      data: { user: User; accessToken: string };
    }>('/auth/2fa/verify-login', { challengeToken, code });
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};
