import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { tokenStore } from './tokenStore';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await tokenStore.clear();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { void logout(); });
    (async () => {
      const token = await tokenStore.get();
      if (token) {
        setAuthToken(token);
        try {
          setUser((await api.me()).user);
        } catch {
          await logout();
        }
      }
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const finish = useCallback(async ({ token, user: u }: { token: string; user: User }) => {
    setAuthToken(token);
    await tokenStore.set(token);
    setUser(u);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    logout,
    login: async (email, password) => finish(await api.login(email, password)),
    signup: async (email, password, nickname) => finish(await api.signup(email, password, nickname)),
  }), [user, loading, logout, finish]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
