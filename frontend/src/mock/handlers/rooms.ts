// ============================================================
// 会议室模块 Mock Handlers
// GET/POST/PUT/DELETE /api/rooms, import/export
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockRooms, mockBookings, mockEquipment, getRoomEquipment, generateId, generateRequestId } from '../data/seed';
import type { ApiResponse, MeetingRoom, AvailabilitySlot, PaginatedData } from '../../types';

// 内存中可变的会议室列表
let rooms = [...mockRooms];
let equipment = { ...mockEquipment };

export const roomHandlers = [
  // 会议室列表 + 实时状态
  http.get('/api/rooms', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    const floor = url.searchParams.get('floor');
    const capacityMin = Number(url.searchParams.get('capacity_min')) || 0;
    const capacityMax = Number(url.searchParams.get('capacity_max')) || 999;
    const equipmentTypes = url.searchParams.getAll('equipment_types');

    let filtered = rooms.filter(r => r.status === 'active');

    if (keyword) {
      filtered = filtered.filter(r => r.name.toLowerCase().includes(keyword));
    }
    if (floor) {
      filtered = filtered.filter(r => r.floor === floor);
    }
    filtered = filtered.filter(r => r.capacity >= capacityMin && r.capacity <= capacityMax);

    if (equipmentTypes.length > 0) {
      filtered = filtered.filter(r => {
        const eqs = getRoomEquipment(r.id);
        return equipmentTypes.every(et => eqs.some(e => e.type === et && e.status === 'available'));
      });
    }

    // 附上设备清单和今日预约
    const enriched = filtered.map(r => {
      const roomBookings = mockBookings.filter(
        b => b.room_id === r.id && b.status !== 'cancelled' && b.status !== 'released'
      );
      return {
        ...r,
        equipment: getRoomEquipment(r.id),
        current_status: {
          current: roomBookings.length > 0 ? 'occupied' as const : 'free' as const,
          today_bookings: roomBookings.map(b => ({
            booking_id: b.id,
            title: b.title,
            organizer_name: b.organizer_name || '',
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status,
          })),
        },
      };
    });

    return HttpResponse.json<ApiResponse<MeetingRoom[]>>({
      code: 0,
      message: 'success',
      data: enriched,
      request_id: generateRequestId(),
    });
  }),

  // 会议室详情
  http.get('/api/rooms/:id', async ({ params }) => {
    await delay(200);
    const { id } = params;
    const room = rooms.find(r => r.id === id);
    if (!room) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '会议室不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }

    const roomBookings = mockBookings.filter(
      b => b.room_id === id && b.status !== 'cancelled' && b.status !== 'released'
    );

    return HttpResponse.json<ApiResponse<MeetingRoom>>({
      code: 0,
      message: 'success',
      data: {
        ...room,
        equipment: getRoomEquipment(id),
        current_status: {
          current: roomBookings.length > 0 ? 'occupied' : 'free',
          today_bookings: roomBookings.map(b => ({
            booking_id: b.id,
            title: b.title,
            organizer_name: b.organizer_name || '',
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status,
          })),
        },
      },
      request_id: generateRequestId(),
    });
  }),

  // 可用时段查询
  http.get('/api/rooms/:id/availability', async ({ params, request }) => {
    await delay(200);
    const { id } = params;
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const roomBookings = mockBookings.filter(
      b =>
        b.room_id === id &&
        b.status !== 'cancelled' &&
        b.status !== 'released' &&
        b.start_time.startsWith(date)
    );

    // 生成 08:00-20:00 以 30 分钟为粒度
    const slots: AvailabilitySlot[] = [];
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 30]) {
        const start = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const endMin = m + 30;
        const endH = endMin >= 60 ? h + 1 : h;
        const endM = endMin >= 60 ? endMin - 60 : endMin;
        const end = `${date}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

        const conflict = roomBookings.some(
          b => b.start_time < end && b.end_time > start
        );

        slots.push({ start_time: start, end_time: end, available: !conflict });
      }
    }

    return HttpResponse.json<ApiResponse<AvailabilitySlot[]>>({
      code: 0,
      message: 'success',
      data: slots,
      request_id: generateRequestId(),
    });
  }),

  // 新增会议室
  http.post('/api/rooms', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<MeetingRoom>;
    const newRoom: MeetingRoom = {
      id: generateId('room'),
      name: body.name || '新会议室',
      floor: body.floor || '1F',
      building: body.building || 'A栋',
      capacity: body.capacity || 10,
      room_type: body.room_type || 'medium',
      status: 'active',
      location_desc: body.location_desc || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rooms.push(newRoom);
    return HttpResponse.json<ApiResponse<MeetingRoom>>({
      code: 0,
      message: 'success',
      data: newRoom,
      request_id: generateRequestId(),
    }, { status: 201 });
  }),

  // 修改会议室
  http.put('/api/rooms/:id', async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as Partial<MeetingRoom>;
    const idx = rooms.findIndex(r => r.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '会议室不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    rooms[idx] = { ...rooms[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json<ApiResponse<MeetingRoom>>({
      code: 0,
      message: 'success',
      data: rooms[idx],
      request_id: generateRequestId(),
    });
  }),

  // 停用会议室
  http.delete('/api/rooms/:id', async ({ params }) => {
    await delay(300);
    const { id } = params;
    const idx = rooms.findIndex(r => r.id === id);
    if (idx === -1) {
      return HttpResponse.json<ApiResponse<null>>({
        code: 404,
        message: '会议室不存在',
        data: null,
        request_id: generateRequestId(),
      }, { status: 404 });
    }
    rooms[idx] = { ...rooms[idx], status: 'inactive', updated_at: new Date().toISOString() };
    return HttpResponse.json<ApiResponse<MeetingRoom>>({
      code: 0,
      message: 'success',
      data: rooms[idx],
      request_id: generateRequestId(),
    });
  }),

  // 批量导入
  http.post('/api/rooms/import', async () => {
    await delay(500);
    return HttpResponse.json<ApiResponse<{ imported: number; failed: number; errors?: Array<{ row: number; reason: string }> }>>({
      code: 0,
      message: '导入成功',
      data: { imported: 8, failed: 2, errors: [{ row: 3, reason: '会议室名称重复' }, { row: 7, reason: '容量必须大于0' }] },
      request_id: generateRequestId(),
    });
  }),

  // 批量导出
  http.get('/api/rooms/export', async () => {
    await delay(400);
    return new HttpResponse('Mock Excel Binary', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="rooms.xlsx"',
      },
    });
  }),
];
