import { create } from 'zustand';

export interface User {
  id: number | string;
  name: string;
  email: string;
  created_at?: string;
  [key: string]: unknown;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (user: User, accessToken: string) => set({ user, accessToken }),
  setAccessToken: (accessToken: string) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
