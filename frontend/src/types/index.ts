// ============================================================
// 会议室预约管理系统 — TypeScript 类型定义
// 对齐技术方案 V1.0 MVP
// ============================================================

// ---------- 枚举 ----------

export type RoomType = 'small' | 'medium' | 'large';
export type RoomStatus = 'active' | 'inactive' | 'maintenance';
export type BookingStatus =
  | 'pending_approval'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'released';
export type EquipmentType =
  | 'projector'
  | 'tv'
  | 'vc_terminal'
  | 'mic'
  | 'speaker'
  | 'whiteboard'
  | 'dock'
  | 'adapter'
  | 'phone';
export type EquipmentStatus = 'available' | 'faulty' | 'repairing';
export type RepairStatus = 'pending' | 'accepted' | 'repairing' | 'resolved';
export type UserRole = 'employee' | 'admin' | 'it_admin' | 'super_admin';
export type UserStatus = 'active' | 'disabled';
export type AttendeeStatus = 'invited' | 'accepted' | 'declined' | 'tentative';

// ---------- 统一响应 ----------

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ---------- 用户 ----------

export interface User {
  id: string;
  wecom_user_id: string;
  name: string;
  department: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ---------- 会议室 ----------

export interface MeetingRoom {
  id: string;
  name: string;
  floor: string;
  building: string;
  capacity: number;
  room_type: RoomType;
  status: RoomStatus;
  location_desc: string;
  qr_code?: string;
  equipment?: Equipment[];
  current_status?: RoomTimeSlotStatus;
  created_at: string;
  updated_at: string;
}

export interface RoomTimeSlotStatus {
  current: 'free' | 'occupied' | 'ongoing';
  today_bookings: TimeSlotBooking[];
}

export interface TimeSlotBooking {
  booking_id: string;
  title: string;
  organizer_name: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
}

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  available: boolean;
}

// ---------- 预约 ----------

export interface Booking {
  id: string;
  room_id: string;
  room_name?: string;
  room_floor?: string;
  organizer_id: string;
  organizer_name?: string;
  title: string;
  agenda?: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  release_reason?: string;
  checkin_time?: string;
  attendees?: Attendee[];
  equipment_needed?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateBookingRequest {
  room_id: string;
  title: string;
  agenda?: string;
  start_time: string;
  end_time: string;
  attendee_ids: string[];
  equipment_ids?: string[];
}

export interface UpdateBookingRequest {
  room_id?: string;
  title?: string;
  agenda?: string;
  start_time?: string;
  end_time?: string;
  attendee_ids?: string[];
  equipment_ids?: string[];
}

export interface ConflictInfo {
  has_conflict: boolean;
  existing_booking?: {
    organizer_name: string;
    title: string;
    start_time: string;
    end_time: string;
  };
  alternative_rooms?: MeetingRoom[];
}

// ---------- 参会人 ----------

export interface Attendee {
  id: string;
  booking_id: string;
  user_id: string;
  user_name?: string;
  user_department?: string;
  status: AttendeeStatus;
  notified_at?: string;
}

// ---------- 设备 ----------

export interface Equipment {
  id: string;
  room_id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  last_maintenance?: string;
  qr_code?: string;
}

export interface RepairTicket {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  room_name?: string;
  reporter_id: string;
  reporter_name?: string;
  description: string;
  photo_url?: string;
  status: RepairStatus;
  assignee_id?: string;
  assignee_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ---------- 审批 ----------

export interface Approval {
  id: string;
  booking_id: string;
  room_name: string;
  title: string;
  organizer_name: string;
  start_time: string;
  end_time: string;
  attendees_count: number;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

// ---------- 统计 ----------

export interface DashboardData {
  total_rooms: number;
  occupied_rooms: number;
  free_rooms: number;
  today_bookings: number;
  current_utilization: number;
  floor_stats: FloorStat[];
  trend: TrendPoint[];
  top_rooms: TopRoom[];
}

export interface FloorStat {
  floor: string;
  total: number;
  occupied: number;
  utilization: number;
}

export interface TrendPoint {
  date: string;
  bookings: number;
  utilization: number;
}

export interface TopRoom {
  room_id: string;
  room_name: string;
  floor: string;
  booking_count: number;
  utilization_rate: number;
}

export interface UtilizationReport {
  room_id: string;
  room_name: string;
  utilization_rate: number;
  total_bookings: number;
  cancelled_bookings: number;
  avg_duration_minutes: number;
}

// ---------- 筛选 ----------

export interface RoomFilter {
  keyword?: string;
  floor?: string;
  capacity_min?: number;
  capacity_max?: number;
  equipment_types?: EquipmentType[];
  date?: string;
  start_time?: string;
  end_time?: string;
}

// ---------- 企微相关 ----------

export interface WeComOAuthResponse {
  access_token: string;
  expires_in: number;
  user_info: {
    userid: string;
    name: string;
    department: string;
    avatar: string;
  };
}

export interface WeComDepartmentMember {
  userid: string;
  name: string;
  department: string;
  avatar: string;
}

// ---------- 企微日程同步 ----------

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface WeComCalendarEvent {
  id: string;
  booking_id: string;
  cal_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  attendees: string[];
  sync_status: SyncStatus;
  synced_at: string | null;
  sync_error?: string;
}

// ---------- 预约规则 ----------

export interface BookingRules {
  max_advance_days: number;
  latest_booking_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  max_daily_bookings: number;
  small_room_min_attendees: number;
  medium_room_min_attendees: number;
  large_room_min_attendees: number;
  large_room_threshold: number;
  approval_timeout_hours: number;
}
