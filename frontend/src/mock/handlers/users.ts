// ============================================================
// 用户模块 Mock Handlers
// GET /api/users/search?q=
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockUsers, generateRequestId } from '../data/seed';
import type { ApiResponse } from '../../types';

export const userHandlers = [
  // 搜索用户（参会人选择器）
  http.get('/api/users/search', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();

    const results = q
      ? mockUsers.filter(
          u =>
            u.name.toLowerCase().includes(q) ||
            u.department.toLowerCase().includes(q) ||
            u.wecom_user_id.toLowerCase().includes(q)
        )
      : mockUsers;

    return HttpResponse.json<ApiResponse<typeof results>>({
      code: 0,
      message: 'success',
      data: results.slice(0, 20),
      request_id: generateRequestId(),
    });
  }),
];
