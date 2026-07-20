// ============================================================
// 设备模块 Mock Handlers
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockEquipment, mockRepairTickets, generateId, generateRequestId } from '../data/seed';
import type { ApiResponse, Equipment, RepairTicket } from '../../types';

let tickets = [...mockRepairTickets];

export const equipmentHandlers = [
  // 设备列表
  http.get('/api/equipment', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room_id');

    let eqs: Equipment[] = [];
    if (roomId) {
      eqs = mockEquipment[roomId] || [];
    } else {
      eqs = Object.values(mockEquipment).flat();
    }

    return HttpResponse.json<ApiResponse<Equipment[]>>({
      code: 0,
      message: 'success',
      data: eqs,
      request_id: generateRequestId(),
    });
  }),

  // 更新设备状态
  http.put('/api/equipment/:id', async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as Partial<Equipment>;

    // 遍历所有设备找匹配的
    let found = false;
    for (const roomId of Object.keys(mockEquipment)) {
      const idx = mockEquipment[roomId].findIndex(e => e.id === id);
      if (idx !== -1) {
        mockEquipment[roomId][idx] = { ...mockEquipment[roomId][idx], ...body };
        found = true;
        break;
      }
    }

    if (!found) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '设备不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }

    return HttpResponse.json<ApiResponse<null>>({
      code: 0,
      message: '更新成功',
      data: null,
      request_id: generateRequestId(),
    });
  }),

  // 提交报修
  http.post('/api/repair-tickets', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<RepairTicket>;
    const newTicket: RepairTicket = {
      id: generateId('rt'),
      equipment_id: body.equipment_id || '',
      reporter_id: body.reporter_id || 'u-002',
      description: body.description || '',
      photo_url: body.photo_url,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    tickets.push(newTicket);
    return HttpResponse.json<ApiResponse<RepairTicket>>({
      code: 0,
      message: '报修提交成功',
      data: newTicket,
      request_id: generateRequestId(),
    }, { status: 201 });
  }),

  // 更新工单
  http.put('/api/repair-tickets/:id', async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as Partial<RepairTicket>;
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '工单不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    tickets[idx] = { ...tickets[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json<ApiResponse<RepairTicket>>({
      code: 0,
      message: '更新成功',
      data: tickets[idx],
      request_id: generateRequestId(),
    });
  }),
];
