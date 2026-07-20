// ============================================================
// 认证状态管理 (Zustand)
// 管理 JWT Token、当前用户、登录/登出
// ============================================================

import { create } from 'zustand';
import type { User, AuthTokens } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // 企微 OAuth 登录流程 (Mock)
  loginViaWeCom: (code?: string) => Promise<void>;
  // 直接 Mock 登录
  login: (userId: string) => Promise<void>;
  // 登出
  logout: () => void;
  // 刷新 Token
  refreshToken: () => Promise<void>;
  // 初始化（从 localStorage 恢复）
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      try {
        const tokens: AuthTokens = JSON.parse(stored);
        set({ tokens, isAuthenticated: true });
        // 验证 Token 有效性
        const res = await api.get<{ code: number; data: User }>('/auth/me');
        if (res.code === 0) {
          set({ user: res.data, isLoading: false });
          return;
        }
      } catch {
        localStorage.removeItem('auth_tokens');
      }
    }
    set({ isLoading: false, isAuthenticated: false });
  },

  loginViaWeCom: async (code?: string) => {
    // Mock 企微 OAuth 流程：
    // 1. 企微回调带 code → 换取 access_token → 获取用户信息
    // 2. 用企微 user_id 调用后端 /api/auth/login 换取 JWT
    const mockWeComUserId = code || 'zhiniu';

    const loginRes = await api.post<{ code: number; data: AuthTokens }>('/auth/login', {
      user_id: mockWeComUserId,
    });

    if (loginRes.code === 0) {
      const tokens = loginRes.data;
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
      set({ tokens, isAuthenticated: true });

      const meRes = await api.get<{ code: number; data: User }>('/auth/me');
      if (meRes.code === 0) {
        set({ user: meRes.data });
      }
    } else {
      throw new Error(loginRes.message || '登录失败');
    }
  },

  login: async (userId: string) => {
    const loginRes = await api.post<{ code: number; data: AuthTokens }>('/auth/login', {
      user_id: userId,
    });

    if (loginRes.code === 0) {
      const tokens = loginRes.data;
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
      set({ tokens, isAuthenticated: true });

      const meRes = await api.get<{ code: number; data: User }>('/auth/me');
      if (meRes.code === 0) {
        set({ user: meRes.data });
      }
    } else {
      throw new Error(loginRes.message || '登录失败');
    }
  },

  logout: () => {
    localStorage.removeItem('auth_tokens');
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    const { tokens } = get();
    if (!tokens?.refresh_token) return;

    try {
      const res = await api.post<{ code: number; data: AuthTokens }>('/auth/refresh');
      if (res.code === 0) {
        const newTokens = res.data;
        localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
        set({ tokens: newTokens });
      }
    } catch {
      get().logout();
    }
  },
}));
