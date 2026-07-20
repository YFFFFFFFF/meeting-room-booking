package model

import "time"

// ========== 枚举 ==========

type RoomType string

const (
	RoomTypeSmall  RoomType = "small"
	RoomTypeMedium RoomType = "medium"
	RoomTypeLarge  RoomType = "large"
)

type RoomStatus string

const (
	RoomStatusActive      RoomStatus = "active"
	RoomStatusInactive    RoomStatus = "inactive"
	RoomStatusMaintenance RoomStatus = "maintenance"
)

type BookingStatus string

const (
	BookingStatusPending  BookingStatus = "pending_approval"
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusCheckedIn BookingStatus = "checked_in"
	BookingStatusCompleted BookingStatus = "completed"
	BookingStatusCancelled BookingStatus = "cancelled"
	BookingStatusReleased  BookingStatus = "released"
)

type EquipmentType string

const (
	EquipProjector  EquipmentType = "projector"
	EquipTV         EquipmentType = "tv"
	EquipVCTerminal EquipmentType = "vc_terminal"
	EquipMic        EquipmentType = "mic"
	EquipSpeaker    EquipmentType = "speaker"
	EquipWhiteboard EquipmentType = "whiteboard"
	EquipDock       EquipmentType = "dock"
	EquipAdapter    EquipmentType = "adapter"
	EquipPhone      EquipmentType = "phone"
)

type EquipmentStatus string

const (
	EquipStatusAvailable EquipmentStatus = "available"
	EquipStatusFaulty    EquipmentStatus = "faulty"
	EquipStatusRepairing EquipmentStatus = "repairing"
)

type RepairStatus string

const (
	RepairPending   RepairStatus = "pending"
	RepairAccepted  RepairStatus = "accepted"
	RepairRepairing RepairStatus = "repairing"
	RepairResolved  RepairStatus = "resolved"
)

type UserRole string

const (
	RoleEmployee  UserRole = "employee"
	RoleAdmin     UserRole = "admin"
	RoleITAdmin   UserRole = "it_admin"
	RoleSuperAdmin UserRole = "super_admin"
)

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
)

type AttendeeStatus string

const (
	AttendeeInvited   AttendeeStatus = "invited"
	AttendeeAccepted  AttendeeStatus = "accepted"
	AttendeeDeclined  AttendeeStatus = "declined"
	AttendeeTentative AttendeeStatus = "tentative"
)

type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
)

// ========== 统一响应 ==========

type ApiResponse struct {
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data"`
	RequestID string      `json:"request_id"`
}

type PaginatedData struct {
	Items    interface{} `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// ========== 数据库模型 ==========

type User struct {
	ID          string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	WecomUserID string     `json:"wecom_user_id" gorm:"uniqueIndex;type:varchar(128)"`
	Name        string     `json:"name" gorm:"type:varchar(64)"`
	Department  string     `json:"department" gorm:"type:varchar(64)"`
	Avatar      string     `json:"avatar" gorm:"type:varchar(512)"`
	Role        UserRole   `json:"role" gorm:"type:varchar(32)"`
	Status      UserStatus `json:"status" gorm:"type:varchar(16)"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type MeetingRoom struct {
	ID           string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name         string    `json:"name" gorm:"type:varchar(128)"`
	Floor        string    `json:"floor" gorm:"type:varchar(16)"`
	Building     string    `json:"building" gorm:"type:varchar(64)"`
	Capacity     int       `json:"capacity"`
	RoomType     RoomType  `json:"room_type" gorm:"type:varchar(16)"`
	Status       RoomStatus `json:"status" gorm:"type:varchar(16)"`
	LocationDesc string    `json:"location_desc" gorm:"type:varchar(256)"`
	QRCode       string    `json:"qr_code" gorm:"type:varchar(512)"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Booking struct {
	ID              string        `json:"id" gorm:"primaryKey;type:varchar(36)"`
	RoomID          string        `json:"room_id" gorm:"type:varchar(36);index"`
	OrganizerID     string        `json:"organizer_id" gorm:"type:varchar(36);index"`
	Title           string        `json:"title" gorm:"type:varchar(256)"`
	Agenda          string        `json:"agenda" gorm:"type:text"`
	StartTime       time.Time     `json:"start_time"`
	EndTime         time.Time     `json:"end_time"`
	Status          BookingStatus `json:"status" gorm:"type:varchar(32);index"`
	ReleaseReason   string        `json:"release_reason" gorm:"type:varchar(256)"`
	CheckinTime     *time.Time    `json:"checkin_time"`
	EquipmentNeeded string        `json:"equipment_needed" gorm:"type:text"` // JSON array
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`

	// 关联
	Room      *MeetingRoom `json:"-" gorm:"foreignKey:RoomID"`
	Organizer *User        `json:"-" gorm:"foreignKey:OrganizerID"`
	Attendees []Attendee   `json:"-" gorm:"foreignKey:BookingID"`
}

type Attendee struct {
	ID         string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	BookingID  string         `json:"booking_id" gorm:"type:varchar(36);index"`
	UserID     string         `json:"user_id" gorm:"type:varchar(36)"`
	Status     AttendeeStatus `json:"status" gorm:"type:varchar(16)"`
	NotifiedAt *time.Time     `json:"notified_at"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`

	User *User `json:"-" gorm:"foreignKey:UserID"`
}

type Equipment struct {
	ID             string          `json:"id" gorm:"primaryKey;type:varchar(36)"`
	RoomID         string          `json:"room_id" gorm:"type:varchar(36);index"`
	Name           string          `json:"name" gorm:"type:varchar(128)"`
	Type           EquipmentType   `json:"type" gorm:"type:varchar(32)"`
	Status         EquipmentStatus `json:"status" gorm:"type:varchar(16)"`
	LastMaintenance *time.Time     `json:"last_maintenance"`
	QRCode         string          `json:"qr_code" gorm:"type:varchar(512)"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type RepairTicket struct {
	ID           string       `json:"id" gorm:"primaryKey;type:varchar(36)"`
	EquipmentID  string       `json:"equipment_id" gorm:"type:varchar(36)"`
	ReporterID   string       `json:"reporter_id" gorm:"type:varchar(36)"`
	Description  string       `json:"description" gorm:"type:text"`
	PhotoURL     string       `json:"photo_url" gorm:"type:varchar(512)"`
	Status       RepairStatus `json:"status" gorm:"type:varchar(16)"`
	AssigneeID   string       `json:"assignee_id" gorm:"type:varchar(36)"`
	ResolvedAt   *time.Time   `json:"resolved_at"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`

	Equipment *Equipment `json:"-" gorm:"foreignKey:EquipmentID"`
	Reporter  *User      `json:"-" gorm:"foreignKey:ReporterID"`
	Assignee  *User      `json:"-" gorm:"foreignKey:AssigneeID"`
}

type Approval struct {
	ID           string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	BookingID    string         `json:"booking_id" gorm:"type:varchar(36);index"`
	Status       ApprovalStatus `json:"status" gorm:"type:varchar(16)"`
	RejectReason string         `json:"reject_reason" gorm:"type:varchar(256)"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`

	Booking *Booking `json:"-" gorm:"foreignKey:BookingID"`
}

type BookingRules struct {
	ID                      uint `json:"-" gorm:"primaryKey;autoIncrement"`
	MaxAdvanceDays          int  `json:"max_advance_days" gorm:"default:30"`
	LatestBookingMinutes    int  `json:"latest_booking_minutes" gorm:"default:15"`
	MinDurationMinutes      int  `json:"min_duration_minutes" gorm:"default:15"`
	MaxDurationMinutes      int  `json:"max_duration_minutes" gorm:"default:240"`
	MaxDailyBookings        int  `json:"max_daily_bookings" gorm:"default:5"`
	SmallRoomMinAttendees   int  `json:"small_room_min_attendees" gorm:"default:1"`
	MediumRoomMinAttendees  int  `json:"medium_room_min_attendees" gorm:"default:3"`
	LargeRoomMinAttendees   int  `json:"large_room_min_attendees" gorm:"default:10"`
	LargeRoomThreshold      int  `json:"large_room_threshold" gorm:"default:20"`
	ApprovalTimeoutHours    int  `json:"approval_timeout_hours" gorm:"default:24"`
}

func (BookingRules) TableName() string {
	return "booking_rules"
}

// ========== 请求/响应 DTO ==========

type CreateBookingRequest struct {
	RoomID        string   `json:"room_id" binding:"required"`
	Title         string   `json:"title" binding:"required"`
	Agenda        string   `json:"agenda"`
	StartTime     string   `json:"start_time" binding:"required"`
	EndTime       string   `json:"end_time" binding:"required"`
	AttendeeIDs   []string `json:"attendee_ids"`
	EquipmentIDs  []string `json:"equipment_ids"`
}

type UpdateBookingRequest struct {
	RoomID       *string  `json:"room_id"`
	Title        *string  `json:"title"`
	Agenda       *string  `json:"agenda"`
	StartTime    *string  `json:"start_time"`
	EndTime      *string  `json:"end_time"`
	AttendeeIDs  []string `json:"attendee_ids"`
	EquipmentIDs []string `json:"equipment_ids"`
}

type RoomFilter struct {
	Keyword        string   `form:"keyword"`
	Floor          string   `form:"floor"`
	CapacityMin    int      `form:"capacity_min"`
	CapacityMax    int      `form:"capacity_max"`
	EquipmentTypes []string `form:"equipment_types"`
	Date           string   `form:"date"`
	StartTime      string   `form:"start_time"`
	EndTime        string   `form:"end_time"`
}

type LoginRequest struct {
	UserID   string `json:"user_id"`
	Password string `json:"password"`
}

type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// ========== 响应增强结构 ==========

type TimeSlotBooking struct {
	BookingID     string        `json:"booking_id"`
	Title         string        `json:"title"`
	OrganizerName string        `json:"organizer_name"`
	StartTime     string        `json:"start_time"`
	EndTime       string        `json:"end_time"`
	Status        BookingStatus `json:"status"`
}

type RoomTimeSlotStatus struct {
	Current       string             `json:"current"`
	TodayBookings []TimeSlotBooking  `json:"today_bookings"`
}

type RoomWithStatus struct {
	MeetingRoom
	Equipment     []Equipment        `json:"equipment"`
	CurrentStatus *RoomTimeSlotStatus `json:"current_status"`
}

type AvailabilitySlot struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Available bool   `json:"available"`
}

type ConflictInfo struct {
	HasConflict      bool           `json:"has_conflict"`
	ExistingBooking  *struct {
		OrganizerName string `json:"organizer_name"`
		Title         string `json:"title"`
		StartTime     string `json:"start_time"`
		EndTime       string `json:"end_time"`
	} `json:"existing_booking"`
	AlternativeRooms []MeetingRoom `json:"alternative_rooms"`
}

type BookingWithDetails struct {
	Booking
	RoomName      string   `json:"room_name"`
	RoomFloor     string   `json:"room_floor"`
	OrganizerName string   `json:"organizer_name"`
}

type DashboardData struct {
	TotalRooms        int         `json:"total_rooms"`
	OccupiedRooms     int         `json:"occupied_rooms"`
	FreeRooms         int         `json:"free_rooms"`
	TodayBookings     int64       `json:"today_bookings"`
	CurrentUtilization float64    `json:"current_utilization"`
	FloorStats        []FloorStat `json:"floor_stats"`
}

type FloorStat struct {
	Floor       string  `json:"floor"`
	Total       int     `json:"total"`
	Occupied    int     `json:"occupied"`
	Utilization float64 `json:"utilization"`
}

type UtilizationReport struct {
	RoomID              string  `json:"room_id"`
	RoomName            string  `json:"room_name"`
	UtilizationRate     float64 `json:"utilization_rate"`
	TotalBookings       int64   `json:"total_bookings"`
	CancelledBookings   int64   `json:"cancelled_bookings"`
	AvgDurationMinutes  float64 `json:"avg_duration_minutes"`
}
