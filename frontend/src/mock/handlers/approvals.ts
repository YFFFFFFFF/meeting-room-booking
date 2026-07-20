// ============================================================
// 审批模块 Mock Handlers
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockApprovals, generateRequestId } from '../data/seed';
import type { ApiResponse, Approval } from '../../types';

let approvals = [...mockApprovals];

export const approvalHandlers = [
  // 待审批列表
  http.get('/api/approvals/pending', async () => {
    await delay(200);
    return HttpResponse.json<ApiResponse<Approval[]>>({
      code: 0,
      message: 'success',
      data: approvals.filter(a => a.status === 'pending'),
      request_id: generateRequestId(),
    });
  }),

  // 通过审批
  http.post('/api/approvals/:id/approve', async ({ params }) => {
    await delay(300);
    const { id } = params;
    const idx = approvals.findIndex(a => a.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '审批不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    approvals[idx] = { ...approvals[idx], status: 'approved', updated_at: new Date().toISOString() };
    return HttpResponse.json<ApiResponse<Approval>>({
      code: 0,
      message: '已通过',
      data: approvals[idx],
      request_id: generateRequestId(),
    });
  }),

  // 驳回审批
  http.post('/api/approvals/:id/reject', async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as { reason: string };
    const idx = approvals.findIndex(a => a.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '审批不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    approvals[idx] = {
      ...approvals[idx],
      status: 'rejected',
      reject_reason: body.reason,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json<ApiResponse<Approval>>({
      code: 0,
      message: '已驳回',
      data: approvals[idx],
      request_id: generateRequestId(),
    });
  }),
];
