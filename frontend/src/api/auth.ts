import apiClient from './client';
import type { SignupInput, LoginInput } from '../features/auth/schemas';
import type { User } from '../features/auth/authStore';

export interface AuthResponseData {
  user: User;
  accessToken: string;
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
 * Registers a new user.
 */
export const signup = async (data: SignupInput): Promise<AuthResponseData> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: AuthResponseData }>(
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
