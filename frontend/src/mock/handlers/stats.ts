// ============================================================
// 统计模块 Mock Handlers
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockDashboard, generateRequestId } from '../data/seed';
import type { ApiResponse, DashboardData, UtilizationReport } from '../../types';

export const statsHandlers = [
  // 实时看板
  http.get('/api/stats/dashboard', async () => {
    await delay(300);
    return HttpResponse.json<ApiResponse<DashboardData>>({
      code: 0,
      message: 'success',
      data: mockDashboard,
      request_id: generateRequestId(),
    });
  }),

  // 利用率报表
  http.get('/api/stats/utilization', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date') || '2026-07-01';
    const endDate = url.searchParams.get('end_date') || '2026-07-31';

    const report: UtilizationReport[] = [
      { room_id: 'room-001', room_name: '3F-长江', utilization_rate: 65.2, total_bookings: 120, cancelled_bookings: 8, avg_duration_minutes: 45 },
      { room_id: 'room-002', room_name: '3F-黄河', utilization_rate: 78.5, total_bookings: 145, cancelled_bookings: 12, avg_duration_minutes: 55 },
      { room_id: 'room-003', room_name: '3F-珠江', utilization_rate: 52.3, total_bookings: 98, cancelled_bookings: 5, avg_duration_minutes: 30 },
      { room_id: 'room-004', room_name: '5F-泰山', utilization_rate: 88.9, total_bookings: 200, cancelled_bookings: 15, avg_duration_minutes: 90 },
      { room_id: 'room-005', room_name: '5F-华山', utilization_rate: 72.1, total_bookings: 165, cancelled_bookings: 10, avg_duration_minutes: 60 },
      { room_id: 'room-007', room_name: '8F-报告厅A', utilization_rate: 45.8, total_bookings: 60, cancelled_bookings: 3, avg_duration_minutes: 120 },
      { room_id: 'room-008', room_name: '8F-报告厅B', utilization_rate: 38.2, total_bookings: 45, cancelled_bookings: 2, avg_duration_minutes: 90 },
      { room_id: 'room-009', room_name: '10F-云端', utilization_rate: 70.4, total_bookings: 150, cancelled_bookings: 9, avg_duration_minutes: 50 },
      { room_id: 'room-010', room_name: '10F-星空', utilization_rate: 68.7, total_bookings: 140, cancelled_bookings: 7, avg_duration_minutes: 45 },
    ];

    return HttpResponse.json<ApiResponse<UtilizationReport[]>>({
      code: 0,
      message: 'success',
      data: report,
      request_id: generateRequestId(),
    });
  }),

  // 导出报表
  http.get('/api/stats/export', async () => {
    await delay(500);
    return new HttpResponse('Mock Excel Report Binary', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="stats.xlsx"',
      },
    });
  }),
];
