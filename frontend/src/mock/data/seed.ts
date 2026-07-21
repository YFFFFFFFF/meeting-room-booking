// ============================================================
// Mock 种子数据 — 对齐技术方案 V1.0 MVP
// 10 间会议室 + 15 个用户 + 预约规则 + 示例预约
// ============================================================

import type {
  User,
  MeetingRoom,
  Equipment,
  Booking,
  BookingRules,
  RepairTicket,
  Approval,
  DashboardData,
} from '../../types';

// ---------- 用户数据 (15人，覆盖4种角色) ----------

export const mockUsers: User[] = [
  { id: 'u-001', wecom_user_id: 'muzirili', name: '木子日立', department: '技术部', role: 'super_admin', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-002', wecom_user_id: 'zhiniu', name: '执拗', department: '产品部', role: 'admin', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-003', wecom_user_id: 'zhangsan', name: '张三', department: '技术部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-004', wecom_user_id: 'lisi', name: '李四', department: '产品部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-005', wecom_user_id: 'wangwu', name: '王五', department: '市场部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-006', wecom_user_id: 'zhaoliu', name: '赵六', department: '设计部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-007', wecom_user_id: 'sunqi', name: '孙七', department: '技术部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-008', wecom_user_id: 'zhouba', name: '周八', department: '行政部', role: 'admin', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-009', wecom_user_id: 'wujiu', name: '吴九', department: '市场部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-010', wecom_user_id: 'zhengshi', name: '郑十', department: '财务部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-011', wecom_user_id: 'it_ops', name: 'IT运维', department: 'IT部', role: 'it_admin', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-012', wecom_user_id: 'chenyi', name: '陈一', department: '技术部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-013', wecom_user_id: 'liner', name: '林二', department: '产品部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-014', wecom_user_id: 'huangsan', name: '黄三', department: '设计部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'u-015', wecom_user_id: 'liusi', name: '刘四', department: '行政部', role: 'employee', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
];

export const currentUser = mockUsers[1]; // 执拗

// ---------- 设备数据 ----------

export const mockEquipment: Record<string, Equipment[]> = {
  'room-001': [
    { id: 'eq-001', room_id: 'room-001', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
    { id: 'eq-002', room_id: 'room-001', name: '扩展坞', type: 'dock', status: 'available', last_maintenance: '2026-07-01' },
  ],
  'room-002': [
    { id: 'eq-003', room_id: 'room-002', name: '投影仪', type: 'projector', status: 'available', last_maintenance: '2026-07-05' },
    { id: 'eq-004', room_id: 'room-002', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
    { id: 'eq-005', room_id: 'room-002', name: '会议电话', type: 'phone', status: 'faulty', last_maintenance: '2026-06-20' },
  ],
  'room-003': [
    { id: 'eq-006', room_id: 'room-003', name: '电视屏幕', type: 'tv', status: 'available', last_maintenance: '2026-07-08' },
    { id: 'eq-007', room_id: 'room-003', name: '扩展坞', type: 'dock', status: 'available', last_maintenance: '2026-07-01' },
  ],
  'room-004': [
    { id: 'eq-008', room_id: 'room-004', name: '投影仪', type: 'projector', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-009', room_id: 'room-004', name: '视频会议终端', type: 'vc_terminal', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-010', room_id: 'room-004', name: '麦克风', type: 'mic', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-011', room_id: 'room-004', name: '音响', type: 'speaker', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-012', room_id: 'room-004', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
  ],
  'room-005': [
    { id: 'eq-013', room_id: 'room-005', name: '电视屏幕', type: 'tv', status: 'available', last_maintenance: '2026-07-08' },
    { id: 'eq-014', room_id: 'room-005', name: '视频会议终端', type: 'vc_terminal', status: 'repairing', last_maintenance: '2026-06-25' },
    { id: 'eq-015', room_id: 'room-005', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
  ],
  'room-006': [
    { id: 'eq-016', room_id: 'room-006', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
  ],
  'room-007': [
    { id: 'eq-017', room_id: 'room-007', name: '投影仪', type: 'projector', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-018', room_id: 'room-007', name: '视频会议终端', type: 'vc_terminal', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-019', room_id: 'room-007', name: '麦克风', type: 'mic', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-020', room_id: 'room-007', name: '音响', type: 'speaker', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-021', room_id: 'room-007', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
    { id: 'eq-022', room_id: 'room-007', name: '转接头', type: 'adapter', status: 'available', last_maintenance: '2026-07-01' },
  ],
  'room-008': [
    { id: 'eq-023', room_id: 'room-008', name: '投影仪', type: 'projector', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-024', room_id: 'room-008', name: '麦克风', type: 'mic', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-025', room_id: 'room-008', name: '音响', type: 'speaker', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-026', room_id: 'room-008', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
  ],
  'room-009': [
    { id: 'eq-027', room_id: 'room-009', name: '电视屏幕', type: 'tv', status: 'available', last_maintenance: '2026-07-08' },
    { id: 'eq-028', room_id: 'room-009', name: '视频会议终端', type: 'vc_terminal', status: 'available', last_maintenance: '2026-07-12' },
    { id: 'eq-029', room_id: 'room-009', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
    { id: 'eq-030', room_id: 'room-009', name: '扩展坞', type: 'dock', status: 'available', last_maintenance: '2026-07-01' },
  ],
  'room-010': [
    { id: 'eq-031', room_id: 'room-010', name: '投影仪', type: 'projector', status: 'available', last_maintenance: '2026-07-05' },
    { id: 'eq-032', room_id: 'room-010', name: '白板', type: 'whiteboard', status: 'available', last_maintenance: '2026-07-10' },
    { id: 'eq-033', room_id: 'room-010', name: '会议电话', type: 'phone', status: 'available', last_maintenance: '2026-07-01' },
  ],
};

// ---------- 会议室数据 (10间) ----------

export const mockRooms: MeetingRoom[] = [
  { id: 'room-001', name: '3F-长江', floor: '3F', building: 'A栋', capacity: 6, room_type: 'small', status: 'active', location_desc: '3楼东侧走廊尽头', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-002', name: '3F-黄河', floor: '3F', building: 'A栋', capacity: 8, room_type: 'medium', status: 'active', location_desc: '3楼西侧茶水间旁', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-003', name: '3F-珠江', floor: '3F', building: 'A栋', capacity: 4, room_type: 'small', status: 'active', location_desc: '3楼南侧电梯口', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-004', name: '5F-泰山', floor: '5F', building: 'A栋', capacity: 20, room_type: 'large', status: 'active', location_desc: '5楼中心区域', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-005', name: '5F-华山', floor: '5F', building: 'A栋', capacity: 12, room_type: 'medium', status: 'active', location_desc: '5楼北侧', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-006', name: '5F-衡山', floor: '5F', building: 'A栋', capacity: 6, room_type: 'small', status: 'maintenance', location_desc: '5楼东侧', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-15T00:00:00Z' },
  { id: 'room-007', name: '8F-报告厅A', floor: '8F', building: 'B栋', capacity: 50, room_type: 'large', status: 'active', location_desc: '8楼整层', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-008', name: '8F-报告厅B', floor: '8F', building: 'B栋', capacity: 30, room_type: 'large', status: 'active', location_desc: '8楼西翼', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-009', name: '10F-云端', floor: '10F', building: 'A栋', capacity: 10, room_type: 'medium', status: 'active', location_desc: '10楼观景台旁', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'room-010', name: '10F-星空', floor: '10F', building: 'A栋', capacity: 8, room_type: 'medium', status: 'active', location_desc: '10楼南侧', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
];

// ---------- 生成今天的模拟预约数据 ----------

function generateTodayBookings(): Booking[] {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const bookings: Booking[] = [
    {
      id: 'bk-001', room_id: 'room-004', organizer_id: 'u-003', title: 'Q3 技术评审', start_time: `${dateStr}T09:00:00`, end_time: `${dateStr}T10:30:00`, status: 'checked_in',
      checkin_time: `${dateStr}T08:55:00`, organizer_name: '张三', room_name: '5F-泰山', room_floor: '5F',
      attendees: [{ id: 'at-001', booking_id: 'bk-001', user_id: 'u-003', user_name: '张三', status: 'accepted' }],
      created_at: '2026-07-20T10:00:00Z', updated_at: '2026-07-20T10:00:00Z',
    },
    {
      id: 'bk-002', room_id: 'room-002', organizer_id: 'u-004', title: '产品周会', start_time: `${dateStr}T10:00:00`, end_time: `${dateStr}T11:00:00`, status: 'checked_in',
      checkin_time: `${dateStr}T09:52:00`, organizer_name: '李四', room_name: '3F-黄河', room_floor: '3F',
      attendees: [{ id: 'at-002', booking_id: 'bk-002', user_id: 'u-004', user_name: '李四', status: 'accepted' }],
      created_at: '2026-07-20T08:00:00Z', updated_at: '2026-07-20T08:00:00Z',
    },
    {
      id: 'bk-003', room_id: 'room-007', organizer_id: 'u-001', title: '全员月度大会', start_time: `${dateStr}T14:00:00`, end_time: `${dateStr}T16:00:00`, status: 'confirmed',
      organizer_name: '木子日立', room_name: '8F-报告厅A', room_floor: '8F',
      attendees: [
        { id: 'at-003', booking_id: 'bk-003', user_id: 'u-001', user_name: '木子日立', status: 'accepted' },
        { id: 'at-004', booking_id: 'bk-003', user_id: 'u-003', user_name: '张三', status: 'accepted' },
        { id: 'at-005', booking_id: 'bk-003', user_id: 'u-004', user_name: '李四', status: 'accepted' },
      ],
      created_at: '2026-07-19T15:00:00Z', updated_at: '2026-07-19T15:00:00Z',
    },
    {
      id: 'bk-004', room_id: 'room-001', organizer_id: 'u-005', title: '市场推广方案讨论', start_time: `${dateStr}T15:00:00`, end_time: `${dateStr}T16:00:00`, status: 'confirmed',
      organizer_name: '王五', room_name: '3F-长江', room_floor: '3F',
      attendees: [{ id: 'at-006', booking_id: 'bk-004', user_id: 'u-005', user_name: '王五', status: 'accepted' }],
      created_at: '2026-07-20T11:00:00Z', updated_at: '2026-07-20T11:00:00Z',
    },
    {
      id: 'bk-005', room_id: 'room-005', organizer_id: 'u-002', title: 'PRD 评审会', start_time: `${dateStr}T14:00:00`, end_time: `${dateStr}T15:00:00`, status: 'confirmed',
      organizer_name: '执拗', room_name: '5F-华山', room_floor: '5F',
      attendees: [
        { id: 'at-007', booking_id: 'bk-005', user_id: 'u-002', user_name: '执拗', status: 'accepted' },
        { id: 'at-008', booking_id: 'bk-005', user_id: 'u-004', user_name: '李四', status: 'accepted' },
      ],
      created_at: '2026-07-20T09:30:00Z', updated_at: '2026-07-20T09:30:00Z',
    },
    {
      id: 'bk-006', room_id: 'room-009', organizer_id: 'u-006', title: 'UI 设计评审', start_time: `${dateStr}T10:00:00`, end_time: `${dateStr}T11:30:00`, status: 'confirmed',
      organizer_name: '赵六', room_name: '10F-云端', room_floor: '10F',
      attendees: [{ id: 'at-009', booking_id: 'bk-006', user_id: 'u-006', user_name: '赵六', status: 'accepted' }],
      created_at: '2026-07-19T18:00:00Z', updated_at: '2026-07-19T18:00:00Z',
    },
    {
      id: 'bk-007', room_id: 'room-010', organizer_id: 'u-009', title: '客户演示', start_time: `${dateStr}T16:00:00`, end_time: `${dateStr}T17:00:00`, status: 'confirmed',
      organizer_name: '吴九', room_name: '10F-星空', room_floor: '10F',
      attendees: [{ id: 'at-010', booking_id: 'bk-007', user_id: 'u-009', user_name: '吴九', status: 'accepted' }],
      created_at: '2026-07-20T12:00:00Z', updated_at: '2026-07-20T12:00:00Z',
    },
    // 已取消的预约
    {
      id: 'bk-008', room_id: 'room-003', organizer_id: 'u-007', title: '代码 Review', start_time: `${dateStr}T09:00:00`, end_time: `${dateStr}T10:00:00`, status: 'cancelled',
      organizer_name: '孙七', room_name: '3F-珠江', room_floor: '3F', release_reason: '会议取消',
      created_at: '2026-07-20T07:00:00Z', updated_at: '2026-07-20T07:30:00Z',
    },
    // 已释放（未签到）
    {
      id: 'bk-009', room_id: 'room-001', organizer_id: 'u-012', title: '站会', start_time: `${dateStr}T08:00:00`, end_time: `${dateStr}T08:30:00`, status: 'released',
      release_reason: '超时未签到自动释放', organizer_name: '陈一', room_name: '3F-长江', room_floor: '3F',
      created_at: '2026-07-20T06:00:00Z', updated_at: '2026-07-20T08:05:00Z',
    },
  ];

  return bookings;
}

export const mockBookings = generateTodayBookings();

// ---------- 预约规则 ----------

export const mockBookingRules: BookingRules = {
  max_advance_days: 30,
  latest_booking_minutes: 15,
  min_duration_minutes: 15,
  max_duration_minutes: 240,
  max_daily_bookings: 5,
  small_room_min_attendees: 1,
  medium_room_min_attendees: 3,
  large_room_min_attendees: 10,
  large_room_threshold: 20,
  approval_timeout_hours: 24,
};

// ---------- 报修工单 ----------

export const mockRepairTickets: RepairTicket[] = [
  {
    id: 'rt-001', equipment_id: 'eq-005', equipment_name: '会议电话', room_name: '3F-黄河',
    reporter_id: 'u-003', reporter_name: '张三', description: '会议电话无法拨入，显示网络错误',
    status: 'accepted', assignee_id: 'u-011', assignee_name: 'IT运维',
    created_at: '2026-07-18T14:00:00Z', updated_at: '2026-07-19T09:00:00Z',
  },
  {
    id: 'rt-002', equipment_id: 'eq-014', equipment_name: '视频会议终端', room_name: '5F-华山',
    reporter_id: 'u-005', reporter_name: '王五', description: '视频会议终端画面卡顿，无法正常使用',
    status: 'repairing', assignee_id: 'u-011', assignee_name: 'IT运维',
    created_at: '2026-07-19T11:00:00Z', updated_at: '2026-07-19T14:00:00Z',
  },
];

// ---------- 审批 ----------

export const mockApprovals: Approval[] = [
  {
    id: 'ap-001', booking_id: 'bk-010', room_name: '8F-报告厅B', title: '部门季度总结',
    organizer_name: '王五', start_time: '2026-07-22T14:00:00', end_time: '2026-07-22T16:00:00',
    attendees_count: 25, status: 'pending', created_at: '2026-07-20T16:00:00Z', updated_at: '2026-07-20T16:00:00Z',
  },
];

// ---------- 看板数据 ----------

export const mockDashboard: DashboardData = {
  total_rooms: 10,
  occupied_rooms: 5,
  free_rooms: 4,
  today_bookings: 9,
  current_utilization: 55.6,
  floor_stats: [
    { floor: '3F', total: 3, occupied: 1, utilization: 33.3 },
    { floor: '5F', total: 3, occupied: 2, utilization: 66.7 },
    { floor: '8F', total: 2, occupied: 1, utilization: 50.0 },
    { floor: '10F', total: 2, occupied: 1, utilization: 50.0 },
  ],
  trend: [
    { date: '07-14', bookings: 28, utilization: 52.3 },
    { date: '07-15', bookings: 35, utilization: 65.1 },
    { date: '07-16', bookings: 42, utilization: 78.2 },
    { date: '07-17', bookings: 38, utilization: 70.5 },
    { date: '07-18', bookings: 45, utilization: 83.7 },
    { date: '07-19', bookings: 30, utilization: 55.8 },
    { date: '07-20', bookings: 9, utilization: 16.7 },
  ],
  top_rooms: [
    { room_id: 'room-004', room_name: '5F-泰山', floor: '5F', booking_count: 200, utilization_rate: 88.9 },
    { room_id: 'room-002', room_name: '3F-黄河', floor: '3F', booking_count: 145, utilization_rate: 78.5 },
    { room_id: 'room-005', room_name: '5F-华山', floor: '5F', booking_count: 165, utilization_rate: 72.1 },
    { room_id: 'room-009', room_name: '10F-云端', floor: '10F', booking_count: 150, utilization_rate: 70.4 },
    { room_id: 'room-010', room_name: '10F-星空', floor: '10F', booking_count: 140, utilization_rate: 68.7 },
  ],
};

// ---------- 工具函数 ----------

export function getRoomEquipment(roomId: string): Equipment[] {
  return mockEquipment[roomId] || [];
}

export function getUserById(id: string): User | undefined {
  return mockUsers.find(u => u.id === id);
}

export function getUserByWeComId(wecomId: string): User | undefined {
  return mockUsers.find(u => u.wecom_user_id === wecomId);
}

export function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${random}`;
}

export function generateRequestId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
