import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  [key: string]: unknown;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (user: User, accessToken: string) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
