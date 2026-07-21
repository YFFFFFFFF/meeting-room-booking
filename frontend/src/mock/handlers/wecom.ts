// ============================================================
// 企微 API Mock Handlers
// Mock 企微 OAuth / 消息推送 / 通讯录 / 日程 API
// 企微权限未就绪时，Mock 返回标准响应，开发不阻塞
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { mockUsers, generateRequestId } from '../data/seed';
import type { ApiResponse, WeComOAuthResponse, WeComDepartmentMember } from '../../types';

// 企微 API Base URL (Mock)
const WECOM_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

export const wecomHandlers = [
  // ============ OAuth 认证 ============

  // 获取 access_token
  http.get(`${WECOM_BASE}/gettoken`, async () => {
    await delay(200);
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      access_token: `mock-wecom-access-${Date.now()}`,
      expires_in: 7200,
    });
  }),

  // 构造 OAuth 授权 URL（前端直接跳转，Mock 直接返回用户信息）
  // 实际企微会跳转 redirect_uri?code=xxx
  http.get(`${WECOM_BASE}/user/getuserinfo`, async () => {
    await delay(200);
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      UserId: 'zhiniu',
      DeviceId: 'mock-device',
    });
  }),

  // 获取用户详细信息
  http.get(`${WECOM_BASE}/user/get`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const userid = url.searchParams.get('userid') || 'zhiniu';
    const user = mockUsers.find(u => u.wecom_user_id === userid);

    if (!user) {
      return HttpResponse.json({
        errcode: 60111,
        errmsg: 'userid not found',
      });
    }

    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      userid: user.wecom_user_id,
      name: user.name,
      department: [1],
      order: [1],
      position: '员工',
      mobile: '13800138000',
      gender: '1',
      email: `${user.wecom_user_id}@company.com`,
      avatar: user.avatar || '',
      status: 1,
      main_department: 1,
    });
  }),

  // ============ 通讯录 ============

  // 部门列表
  http.get(`${WECOM_BASE}/department/list`, async () => {
    await delay(150);
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      department: [
        { id: 1, name: '公司总部', parentid: 0 },
        { id: 2, name: '技术部', parentid: 1 },
        { id: 3, name: '产品部', parentid: 1 },
        { id: 4, name: '市场部', parentid: 1 },
        { id: 5, name: '设计部', parentid: 1 },
        { id: 6, name: '行政部', parentid: 1 },
        { id: 7, name: '财务部', parentid: 1 },
        { id: 8, name: 'IT部', parentid: 1 },
      ],
    });
  }),

  // 部门成员列表
  http.get(`${WECOM_BASE}/user/simplelist`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const departmentId = Number(url.searchParams.get('department_id')) || 1;

    // 部门ID映射
    const deptMap: Record<number, string> = {
      1: '', 2: '技术部', 3: '产品部', 4: '市场部', 5: '设计部', 6: '行政部', 7: '财务部', 8: 'IT部',
    };

    const deptName = deptMap[departmentId] || '';
    const members: WeComDepartmentMember[] = mockUsers
      .filter(u => !deptName || u.department === deptName)
      .map(u => ({
        userid: u.wecom_user_id,
        name: u.name,
        department: u.department,
        avatar: u.avatar || '',
      }));

    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      userlist: members,
    });
  }),

  // ============ 消息推送 ============

  // 发送应用消息
  http.post(`${WECOM_BASE}/message/send`, async () => {
    await delay(100);
    // Mock: 总是成功
    console.log('[Mock WeCom] Message sent successfully');
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      invaliduser: '',
      invalidparty: '',
      invalidtag: '',
    });
  }),

  // 发送模板卡片消息
  http.post(`${WECOM_BASE}/message/send_template_card`, async () => {
    await delay(100);
    console.log('[Mock WeCom] Template card sent successfully');
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
    });
  }),

  // ============ 日程 ============

  // 创建日程
  http.post(`${WECOM_BASE}/calendar/calendar/add`, async () => {
    await delay(200);
    console.log('[Mock WeCom] Calendar event created');
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      cal_id: `mock-cal-${Date.now()}`,
    });
  }),

  // 更新日程
  http.post(`${WECOM_BASE}/calendar/calendar/update`, async () => {
    await delay(200);
    console.log('[Mock WeCom] Calendar event updated');
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
    });
  }),

  // 删除日程
  http.post(`${WECOM_BASE}/calendar/calendar/delete`, async () => {
    await delay(150);
    console.log('[Mock WeCom] Calendar event deleted');
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
    });
  }),

  // ============ JSSDK 配置 ============

  // 获取 JSSDK ticket
  http.get(`${WECOM_BASE}/get_jsapi_ticket`, async () => {
    await delay(100);
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      ticket: `mock-jsapi-ticket-${Date.now()}`,
      expires_in: 7200,
    });
  }),

  // 获取应用 Ticket
  http.get(`${WECOM_BASE}/ticket/get`, async () => {
    await delay(100);
    return HttpResponse.json({
      errcode: 0,
      errmsg: 'ok',
      ticket: `mock-app-ticket-${Date.now()}`,
      expires_in: 7200,
    });
  }),

  // ============ 日程同步 API（后端） ============

  // 获取已同步的日程列表
  http.get('/api/wecom/calendar/events', async () => {
    await delay(300);
    return HttpResponse.json<ApiResponse<WeComCalendarEvent[]>>({
      code: 0,
      message: 'success',
      data: [
        {
          id: 'evt-001',
          booking_id: 'booking-001',
          cal_id: 'mock-cal-001',
          title: 'Q3 产品评审 — 3F-长江',
          start_time: '2026-07-20T09:00:00+08:00',
          end_time: '2026-07-20T10:00:00+08:00',
          attendees: ['zhiniu', 'zhangsan', 'lisi'],
          sync_status: 'synced',
          synced_at: '2026-07-19T18:30:00+08:00',
        },
        {
          id: 'evt-002',
          booking_id: 'booking-002',
          cal_id: 'mock-cal-002',
          title: '技术分享会 — 5F-泰山',
          start_time: '2026-07-20T14:00:00+08:00',
          end_time: '2026-07-20T16:00:00+08:00',
          attendees: ['muzirili', 'wangwu'],
          sync_status: 'synced',
          synced_at: '2026-07-19T20:15:00+08:00',
        },
        {
          id: 'evt-003',
          booking_id: 'booking-003',
          cal_id: null,
          title: '周例会 — 8F-报告厅A',
          start_time: '2026-07-21T10:00:00+08:00',
          end_time: '2026-07-21T11:00:00+08:00',
          attendees: ['zhiniu', 'muzirili', 'zhangsan', 'lisi', 'wangwu'],
          sync_status: 'pending',
          synced_at: null,
        },
        {
          id: 'evt-004',
          booking_id: 'booking-004',
          cal_id: 'mock-cal-004',
          title: '客户演示 — 10F-云端',
          start_time: '2026-07-20T15:00:00+08:00',
          end_time: '2026-07-20T16:30:00+08:00',
          attendees: ['zhiniu', 'zhangsan'],
          sync_status: 'failed',
          synced_at: '2026-07-19T17:00:00+08:00',
          sync_error: '企微 API 超时',
        },
      ],
      request_id: generateRequestId(),
    });
  }),

  // 手动触发同步
  http.post('/api/wecom/calendar/sync', async () => {
    await delay(800);
    return HttpResponse.json<ApiResponse<{ synced: number; failed: number; errors?: string[] }>>({
      code: 0,
      message: '同步完成',
      data: { synced: 3, failed: 1, errors: ['evt-004: 企微 API 超时，请稍后重试'] },
      request_id: generateRequestId(),
    });
  }),

  // 同步单个日程
  http.post('/api/wecom/calendar/sync/:eventId', async () => {
    await delay(400);
    return HttpResponse.json<ApiResponse<null>>({
      code: 0,
      message: '同步成功',
      data: null,
      request_id: generateRequestId(),
    });
  }),
];
