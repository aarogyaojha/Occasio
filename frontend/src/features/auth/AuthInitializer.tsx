import React, { useEffect, useState } from 'react';
import { refresh, getMe } from '../../api/auth';
import { useAuthStore } from './authStore';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const refreshData = await refresh();
        if (refreshData?.accessToken) {
          useAuthStore.getState().setAccessToken(refreshData.accessToken);
          const userData = await getMe();
          if (isMounted) {
            setAuth(userData, refreshData.accessToken);
          }
        } else {
          if (isMounted) clearAuth();
        }
      } catch (err: any) {
        const isAuthError =
          err?.status === 401 ||
          err?.response?.status === 401 ||
          err?.code === 'AUTH_TOKEN_INVALID' ||
          err?.code === 'AUTH_TOKEN_EXPIRED';

        if (isMounted && isAuthError) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [setAuth, clearAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex flex-col items-center justify-center font-mono text-xs selection:bg-zinc-100 selection:text-zinc-950">
        <div className="flex items-center space-x-3 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-sm">
          <span className="inline-block w-2 h-2 bg-zinc-100 animate-pulse rounded-full" />
          <span>Initializing session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
