# 数据库迁移脚本
# 创建初始表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    wecom_user_id VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    department VARCHAR(64) DEFAULT '',
    avatar VARCHAR(512) DEFAULT '',
    role VARCHAR(32) DEFAULT 'employee',
    status VARCHAR(16) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会议室表
CREATE TABLE IF NOT EXISTS meeting_rooms (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    floor VARCHAR(16) DEFAULT '',
    building VARCHAR(64) DEFAULT '',
    capacity INT DEFAULT 0,
    room_type VARCHAR(16) DEFAULT 'medium',
    status VARCHAR(16) DEFAULT 'active',
    location_desc VARCHAR(256) DEFAULT '',
    qr_code VARCHAR(512) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 预约表
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL REFERENCES meeting_rooms(id),
    organizer_id VARCHAR(36) NOT NULL REFERENCES users(id),
    title VARCHAR(256) NOT NULL,
    agenda TEXT DEFAULT '',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(32) DEFAULT 'confirmed',
    release_reason VARCHAR(256) DEFAULT '',
    checkin_time TIMESTAMP,
    equipment_needed TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_organizer_id ON bookings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time);

-- 参会人表
CREATE TABLE IF NOT EXISTS attendees (
    id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL REFERENCES bookings(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    status VARCHAR(16) DEFAULT 'invited',
    notified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendees_booking_id ON attendees(booking_id);

-- 设备表
CREATE TABLE IF NOT EXISTS equipment (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL REFERENCES meeting_rooms(id),
    name VARCHAR(128) NOT NULL,
    type VARCHAR(32) DEFAULT 'projector',
    status VARCHAR(16) DEFAULT 'available',
    last_maintenance TIMESTAMP,
    qr_code VARCHAR(512) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_room_id ON equipment(room_id);

-- 报修工单表
CREATE TABLE IF NOT EXISTS repair_tickets (
    id VARCHAR(36) PRIMARY KEY,
    equipment_id VARCHAR(36) NOT NULL REFERENCES equipment(id),
    reporter_id VARCHAR(36) NOT NULL REFERENCES users(id),
    description TEXT DEFAULT '',
    photo_url VARCHAR(512) DEFAULT '',
    status VARCHAR(16) DEFAULT 'pending',
    assignee_id VARCHAR(36) REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审批表
CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL REFERENCES bookings(id),
    status VARCHAR(16) DEFAULT 'pending',
    reject_reason VARCHAR(256) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approvals_booking_id ON approvals(booking_id);

-- 预约规则表
CREATE TABLE IF NOT EXISTS booking_rules (
    id SERIAL PRIMARY KEY,
    max_advance_days INT DEFAULT 30,
    latest_booking_minutes INT DEFAULT 15,
    min_duration_minutes INT DEFAULT 15,
    max_duration_minutes INT DEFAULT 240,
    max_daily_bookings INT DEFAULT 5,
    small_room_min_attendees INT DEFAULT 1,
    medium_room_min_attendees INT DEFAULT 3,
    large_room_min_attendees INT DEFAULT 10,
    large_room_threshold INT DEFAULT 20,
    approval_timeout_hours INT DEFAULT 24
);

-- 插入默认规则
INSERT INTO booking_rules (id) VALUES (1) ON CONFLICT DO NOTHING;
