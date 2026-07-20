// ============================================================
// 认证模块 Mock Handlers
// POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockUsers, currentUser, generateRequestId } from '../data/seed';
import type { ApiResponse, AuthTokens, User } from '../../types';

export const authHandlers = [
  // 登录
  http.post('/api/auth/login', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { user_id?: string; password?: string };
    const userId = body?.user_id || 'zhiniu';

    const user = mockUsers.find(u => u.wecom_user_id === userId);
    if (!user) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 401,
        message: '用户不存在或密码错误',
        data: null,
        request_id: generateRequestId(),
      }, { status: 401 });
    }

    const data: AuthTokens = {
      access_token: `mock-jwt-${user.id}-${Date.now()}`,
      refresh_token: `mock-refresh-${user.id}-${Date.now()}`,
      expires_in: 7200,
    };

    return HttpResponse.json<ApiResponse<AuthTokens>>({
      code: 0,
      message: 'success',
      data,
      request_id: generateRequestId(),
    });
  }),

  // 刷新 Token
  http.post('/api/auth/refresh', async () => {
    await delay(200);
    const data: AuthTokens = {
      access_token: `mock-jwt-refreshed-${Date.now()}`,
      refresh_token: `mock-refresh-${Date.now()}`,
      expires_in: 7200,
    };
    return HttpResponse.json<ApiResponse<AuthTokens>>({
      code: 0,
      message: 'success',
      data,
      request_id: generateRequestId(),
    });
  }),

  // 获取当前用户
  http.get('/api/auth/me', async () => {
    await delay(150);
    return HttpResponse.json<ApiResponse<User>>({
      code: 0,
      message: 'success',
      data: currentUser,
      request_id: generateRequestId(),
    });
  }),
];
