import { useMutation } from '@tanstack/react-query';
import { signup as signupApi, login as loginApi, logout as logoutApi } from '../../api/auth';
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

  const signupMutation = useMutation<
    { user: User; accessToken: string },
    ApiBackendError,
    SignupInput
  >({
    mutationFn: (data: SignupInput) => signupApi(data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
    },
  });

  const loginMutation = useMutation<
    { user: User; accessToken: string },
    ApiBackendError,
    LoginInput
  >({
    mutationFn: (data: LoginInput) => loginApi(data),
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
    signupMutation,
    loginMutation,
    logoutMutation,
  };
};
