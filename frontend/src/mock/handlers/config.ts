// ============================================================
// 配置规则 Mock Handlers
// 预约规则配置、系统配置
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockBookingRules, generateRequestId } from '../data/seed';
import type { ApiResponse, BookingRules } from '../../types';

let bookingRules = { ...mockBookingRules };

export const configHandlers = [
  // 获取预约规则
  http.get('/api/config/booking-rules', async () => {
    await delay(150);
    return HttpResponse.json<ApiResponse<BookingRules>>({
      code: 0,
      message: 'success',
      data: bookingRules,
      request_id: generateRequestId(),
    });
  }),

  // 更新预约规则
  http.put('/api/config/booking-rules', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<BookingRules>;
    bookingRules = { ...bookingRules, ...body };
    return HttpResponse.json<ApiResponse<BookingRules>>({
      code: 0,
      message: '规则更新成功，即时生效',
      data: bookingRules,
      request_id: generateRequestId(),
    });
  }),

  // 获取楼层列表
  http.get('/api/config/floors', async () => {
    await delay(100);
    return HttpResponse.json<ApiResponse<string[]>>({
      code: 0,
      message: 'success',
      data: ['3F', '5F', '8F', '10F'],
      request_id: generateRequestId(),
    });
  }),

  // 获取设备类型列表
  http.get('/api/config/equipment-types', async () => {
    await delay(100);
    return HttpResponse.json<ApiResponse<{ value: string; label: string }[]>>({
      code: 0,
      message: 'success',
      data: [
        { value: 'projector', label: '投影仪' },
        { value: 'tv', label: '电视屏幕' },
        { value: 'vc_terminal', label: '视频会议终端' },
        { value: 'mic', label: '麦克风' },
        { value: 'speaker', label: '音响' },
        { value: 'whiteboard', label: '白板' },
        { value: 'dock', label: '扩展坞' },
        { value: 'adapter', label: '转接头' },
        { value: 'phone', label: '会议电话' },
      ],
      request_id: generateRequestId(),
    });
  }),
];
