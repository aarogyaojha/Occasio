import { useMutation } from '@tanstack/react-query';
import {
  signup as signupApi,
  login as loginApi,
  logout as logoutApi,
  verifyEmail as verifyEmailApi,
  resendVerification as resendVerificationApi,
  setupTwoFactor as setupTwoFactorApi,
  enableTwoFactor as enableTwoFactorApi,
  disableTwoFactor as disableTwoFactorApi,
  verifyTwoFactorLogin as verifyTwoFactorLoginApi,
  type SignupResponseData,
  type AuthResponseData,
  type SetupTwoFactorResponseData,
  type MessageResponseData,
} from '../../api/auth';
import { useAuthStore, type User } from './authStore';
import type { SignupInput, LoginInput } from './schemas';

export interface ApiBackendError {
  code?: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

export const useAuth = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);

  const signupMutation = useMutation<SignupResponseData, ApiBackendError, SignupInput>({
    mutationFn: (data: SignupInput) => signupApi(data),
  });

  const loginMutation = useMutation<AuthResponseData, ApiBackendError, LoginInput>({
    mutationFn: (data: LoginInput) => loginApi(data),
    onSuccess: (data) => {
      if ('user' in data) {
        setAuth(data.user, data.accessToken);
      }
    },
  });

  const verifyEmailMutation = useMutation<MessageResponseData, ApiBackendError, string>({
    mutationFn: (token: string) => verifyEmailApi(token),
  });

  const resendVerificationMutation = useMutation<MessageResponseData, ApiBackendError, string>({
    mutationFn: (email: string) => resendVerificationApi(email),
  });

  const setupTwoFactorMutation = useMutation<SetupTwoFactorResponseData, ApiBackendError, void>({
    mutationFn: () => setupTwoFactorApi(),
  });

  const enableTwoFactorMutation = useMutation<MessageResponseData, ApiBackendError, string>({
    mutationFn: (code: string) => enableTwoFactorApi(code),
  });

  const disableTwoFactorMutation = useMutation<MessageResponseData, ApiBackendError, string>({
    mutationFn: (code: string) => disableTwoFactorApi(code),
  });

  const verifyTwoFactorLoginMutation = useMutation<
    { user: User; accessToken: string },
    ApiBackendError,
    { challengeToken: string; code: string }
  >({
    mutationFn: ({ challengeToken, code }) => verifyTwoFactorLoginApi(challengeToken, code),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
    },
  });

  const logoutMutation = useMutation<void, ApiBackendError, void>({
    mutationFn: async () => {
      await logoutApi();
    },
    onSuccess: () => {
      clearAuth();
    },
    onError: () => {
      clearAuth();
    },
  });

  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    signup: signupMutation.mutateAsync,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    verifyEmail: verifyEmailMutation.mutateAsync,
    resendVerification: resendVerificationMutation.mutateAsync,
    setupTwoFactor: setupTwoFactorMutation.mutateAsync,
    enableTwoFactor: enableTwoFactorMutation.mutateAsync,
    disableTwoFactor: disableTwoFactorMutation.mutateAsync,
    verifyTwoFactorLogin: verifyTwoFactorLoginMutation.mutateAsync,
    signupMutation,
    loginMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    setupTwoFactorMutation,
    enableTwoFactorMutation,
    disableTwoFactorMutation,
    verifyTwoFactorLoginMutation,
    logoutMutation,
  };
};
