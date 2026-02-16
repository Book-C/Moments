import { create } from 'zustand';
import { auth, getToken } from '../services/api';

interface User {
  id: string;
  email: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  timezone: string;
  pushEnabled?: boolean;
  emailDigestEnabled?: boolean;
  digestDay?: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const result = await auth.login(email, password);

    if (result.data) {
      set({ user: result.data.user, isAuthenticated: true });
      return { success: true };
    }

    return { success: false, error: result.error };
  },

  register: async (email: string, password: string, phone?: string) => {
    const result = await auth.register(email, password, phone);

    if (result.data) {
      set({ user: result.data.user, isAuthenticated: true });
      return { success: true };
    }

    return { success: false, error: result.error };
  },

  logout: async () => {
    await auth.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });

    const token = await getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    const result = await auth.getMe();

    if (result.data) {
      set({ user: result.data, isAuthenticated: true, isLoading: false });
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
