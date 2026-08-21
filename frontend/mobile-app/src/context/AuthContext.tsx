import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types';

const STORAGE_KEY = 'bimba.session.user';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  hasOnboarded: boolean;
  completeOnboarding: () => void;
  login: (mobile: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signUp: (name: string, mobile: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
        const onboarded = await AsyncStorage.getItem('bimba.onboarded');
        setHasOnboarded(onboarded === '1');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const completeOnboarding = () => {
    setHasOnboarded(true);
    AsyncStorage.setItem('bimba.onboarded', '1').catch(() => {});
  };

  const login: AuthContextValue['login'] = async (mobile, password) => {
    if (!mobile.trim() || mobile.trim().length < 10) {
      return { ok: false, error: 'Enter a valid 10-digit mobile number.' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Enter your password.' };
    }
    const nextUser: User = {
      id: 'u1',
      name: 'Ragu Prasad',
      mobile: mobile.trim(),
      branchId: 'b1',
    };
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    return { ok: true };
  };

  const signUp: AuthContextValue['signUp'] = async (name, mobile, password) => {
    if (!name.trim()) return { ok: false, error: 'Enter your full name.' };
    if (!mobile.trim() || mobile.trim().length < 10) {
      return { ok: false, error: 'Enter a valid 10-digit mobile number.' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' };
    }
    const nextUser: User = { id: 'u1', name: name.trim(), mobile: mobile.trim(), branchId: 'b1' };
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    return { ok: true };
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ user, isLoading, hasOnboarded, completeOnboarding, login, signUp, logout }),
    [user, isLoading, hasOnboarded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
