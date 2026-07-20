// ============================================================
// 预约模块 Mock Handlers
// POST/PUT/DELETE/GET /api/bookings
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import {
  mockRooms,
  mockBookings,
  mockUsers,
  generateId,
  generateRequestId,
} from '../data/seed';
import type { ApiResponse, Booking, CreateBookingRequest, ConflictInfo, PaginatedData } from '../../types';

let bookings = [...mockBookings];

export const bookingHandlers = [
  // 创建预约
  http.post('/api/bookings', async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as CreateBookingRequest;

    // 冲突检测
    const conflict = bookings.some(
      b =>
        b.room_id === body.room_id &&
        b.status !== 'cancelled' &&
        b.status !== 'released' &&
        b.start_time < body.end_time &&
        b.end_time > body.start_time
    );

    if (conflict) {
      const existing = bookings.find(
        b =>
          b.room_id === body.room_id &&
          b.status !== 'cancelled' &&
          b.status !== 'released' &&
          b.start_time < body.end_time &&
          b.end_time > body.start_time
      );

      const alternativeRooms = mockRooms
        .filter(r => r.id !== body.room_id && r.status === 'active')
        .slice(0, 3);

      return HttpResponse.json<ApiResponse<ConflictInfo>>({
        code: 409,
        message: '该时段已被占用',
        data: {
          has_conflict: true,
          existing_booking: existing
            ? {
                organizer_name: existing.organizer_name || '',
                title: existing.title,
                start_time: existing.start_time,
                end_time: existing.end_time,
              }
            : undefined,
          alternative_rooms: alternativeRooms,
        },
        request_id: generateRequestId(),
      }, { status: 409 });
    }

    const room = mockRooms.find(r => r.id === body.room_id);
    const organizer = mockUsers.find(u => u.id === 'u-002'); // 执拗

    const newBooking: Booking = {
      id: generateId('bk'),
      room_id: body.room_id,
      room_name: room?.name,
      room_floor: room?.floor,
      organizer_id: organizer?.id || 'u-002',
      organizer_name: organizer?.name,
      title: body.title,
      agenda: body.agenda,
      start_time: body.start_time,
      end_time: body.end_time,
      status: room && room.capacity > 20 ? 'pending_approval' : 'confirmed',
      attendees: body.attendee_ids.map(aid => {
        const u = mockUsers.find(mu => mu.id === aid);
        return {
          id: generateId('at'),
          booking_id: 'pending',
          user_id: aid,
          user_name: u?.name,
          status: 'invited' as const,
        };
      }),
      equipment_needed: body.equipment_ids,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bookings.push(newBooking);

    return HttpResponse.json<ApiResponse<Booking>>({
      code: 0,
      message: room && room.capacity > 20 ? '已提交审批，请等待管理员审核' : '预约成功',
      data: newBooking,
      request_id: generateRequestId(),
    }, { status: 201 });
  }),

  // 修改预约
  http.put('/api/bookings/:id', async ({ params, request }) => {
    await delay(400);
    const { id } = params;
    const body = (await request.json()) as Partial<Booking>;
    const idx = bookings.findIndex(b => b.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '预约不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }

    // 如果修改了时间，重新冲突检测
    if (body.start_time || body.end_time) {
      const newStart = body.start_time || bookings[idx].start_time;
      const newEnd = body.end_time || bookings[idx].end_time;
      const conflict = bookings.some(
        b =>
          b.id !== id &&
          b.room_id === bookings[idx].room_id &&
          b.status !== 'cancelled' &&
          b.status !== 'released' &&
          b.start_time < newEnd &&
          b.end_time > newStart
      );
      if (conflict) {
        return HttpResponse.json<ApiResponse<null>>({
          code: 409,
          message: '修改后时间存在冲突',
          data: null,
          request_id: generateRequestId(),
        }, { status: 409 });
      }
    }

    bookings[idx] = { ...bookings[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json<ApiResponse<Booking>>({
      code: 0,
      message: '修改成功',
      data: bookings[idx],
      request_id: generateRequestId(),
    });
  }),

  // 取消预约
  http.delete('/api/bookings/:id', async ({ params }) => {
    await delay(300);
    const { id } = params;
    const idx = bookings.findIndex(b => b.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '预约不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }

    const now = new Date().toISOString();
    const isPast = bookings[idx].start_time < now;
    if (isPast && bookings[idx].status === 'confirmed') {
      return HttpResponse.json<ApiResponse<null>>({
        code: 400,
        message: '会议已开始，不可取消，请联系管理员',
        data: null,
        request_id: generateRequestId(),
      }, { status: 400 });
    }

    bookings[idx] = {
      ...bookings[idx],
      status: 'cancelled',
      release_reason: '用户主动取消',
      updated_at: now,
    };

    return HttpResponse.json<ApiResponse<Booking>>({
      code: 0,
      message: '取消成功',
      data: bookings[idx],
      request_id: generateRequestId(),
    });
  }),

  // 我的预约列表
  http.get('/api/bookings/mine', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('page_size')) || 20;

    let mine = bookings.filter(b => b.organizer_id === 'u-002'); // 当前用户=执拗

    if (status) {
      const statuses = status.split(',');
      mine = mine.filter(b => statuses.includes(b.status));
    }

    // 按开始时间倒序
    mine.sort((a, b) => b.start_time.localeCompare(a.start_time));

    const total = mine.length;
    const items = mine.slice((page - 1) * pageSize, page * pageSize);

    return HttpResponse.json<ApiResponse<PaginatedData<Booking>>>({
      code: 0,
      message: 'success',
      data: { items, total, page, page_size: pageSize },
      request_id: generateRequestId(),
    });
  }),

  // 签到
  http.post('/api/bookings/:id/checkin', async ({ params }) => {
    await delay(300);
    const { id } = params;
    const idx = bookings.findIndex(b => b.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '预约不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    bookings[idx] = {
      ...bookings[idx],
      status: 'checked_in',
      checkin_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json<ApiResponse<Booking>>({
      code: 0,
      message: '签到成功',
      data: bookings[idx],
      request_id: generateRequestId(),
    });
  }),
];
