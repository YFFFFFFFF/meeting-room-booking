package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
)

// CalendarSyncService 企微日历同步服务
type CalendarSyncService struct {
	db    *repository.DB
	cache *repository.Cache
}

func NewCalendarSyncService(db *repository.DB, cache *repository.Cache) *CalendarSyncService {
	return &CalendarSyncService{db: db, cache: cache}
}

// CalendarEvent 企微日历事件
type CalendarEvent struct {
	CalID       string   `json:"cal_id"`
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	Location    string   `json:"location"`
	Attendees   []string `json:"attendees"`
}

// SyncBookingCreated 创建预约时同步到企微日历
func (s *CalendarSyncService) SyncBookingCreated(ctx context.Context, booking *model.Booking) error {
	event, err := s.buildCalendarEvent(booking)
	if err != nil {
		return fmt.Errorf("构建日历事件失败: %w", err)
	}

	// Mock: 调用企微日历 API 创建事件
	calID, err := s.createCalendarEvent(ctx, event)
	if err != nil {
		// 日历同步失败不阻塞预约流程，记录日志
		log.Printf("⚠️ 日历同步失败（预约 %s）: %v", booking.ID, err)
		return nil
	}

	// 缓存 booking_id → cal_id 映射
	s.cache.Set(ctx, "cal:"+booking.ID, calID, 30*24*time.Hour)
	log.Printf("📅 日历事件已创建: booking=%s cal_id=%s", booking.ID, calID)
	return nil
}

// SyncBookingUpdated 修改预约时同步更新日历事件
func (s *CalendarSyncService) SyncBookingUpdated(ctx context.Context, booking *model.Booking) error {
	var calID string
	if err := s.cache.Get(ctx, "cal:"+booking.ID, &calID); err != nil || calID == "" {
		// 没有找到日历事件，创建新的
		return s.SyncBookingCreated(ctx, booking)
	}

	event, err := s.buildCalendarEvent(booking)
	if err != nil {
		return fmt.Errorf("构建日历事件失败: %w", err)
	}
	event.CalID = calID

	if err := s.updateCalendarEvent(ctx, event); err != nil {
		log.Printf("⚠️ 日历更新失败（预约 %s）: %v", booking.ID, err)
		return nil
	}

	log.Printf("📅 日历事件已更新: booking=%s cal_id=%s", booking.ID, calID)
	return nil
}

// SyncBookingCancelled 取消预约时删除日历事件
func (s *CalendarSyncService) SyncBookingCancelled(ctx context.Context, bookingID string) error {
	var calID string
	if err := s.cache.Get(ctx, "cal:"+bookingID, &calID); err != nil || calID == "" {
		// 没有日历事件，无需删除
		return nil
	}

	if err := s.deleteCalendarEvent(ctx, calID); err != nil {
		log.Printf("⚠️ 日历删除失败（预约 %s）: %v", bookingID, err)
		return nil
	}

	s.cache.Del(ctx, "cal:"+bookingID)
	log.Printf("📅 日历事件已删除: booking=%s cal_id=%s", bookingID, calID)
	return nil
}

// buildCalendarEvent 构建日历事件
func (s *CalendarSyncService) buildCalendarEvent(booking *model.Booking) (*CalendarEvent, error) {
	var room model.MeetingRoom
	if err := s.db.First(&room, "id = ?", booking.RoomID).Error; err != nil {
		return nil, err
	}

	var organizer model.User
	if err := s.db.First(&organizer, "id = ?", booking.OrganizerID).Error; err != nil {
		return nil, err
	}

	// 获取参会人
	var attendees []model.Attendee
	s.db.Where("booking_id = ?", booking.ID).Find(&attendees)

	attendeeNames := make([]string, 0, len(attendees))
	for _, a := range attendees {
		var u model.User
		if s.db.First(&u, "id = ?", a.UserID).Error == nil {
			attendeeNames = append(attendeeNames, u.Name)
		}
	}

	// 设备信息
	var equipmentNeeded []string
	json.Unmarshal([]byte(booking.EquipmentNeeded), &equipmentNeeded)

	desc := fmt.Sprintf("组织者: %s\n会议室: %s (%s %s)\n参会人: %v\n议程: %s",
		organizer.Name, room.Name, room.Building, room.Floor,
		attendeeNames, booking.Agenda)

	return &CalendarEvent{
		Summary:     booking.Title,
		Description: desc,
		StartTime:   booking.StartTime.Format("2006-01-02T15:04:05"),
		EndTime:     booking.EndTime.Format("2006-01-02T15:04:05"),
		Location:    fmt.Sprintf("%s %s %s", room.Building, room.Floor, room.LocationDesc),
		Attendees:   attendeeNames,
	}, nil
}

// createCalendarEvent Mock 创建日历事件
func (s *CalendarSyncService) createCalendarEvent(ctx context.Context, event *CalendarEvent) (string, error) {
	// TODO: 真实环境调用企微 API
	// POST https://qyapi.weixin.qq.com/cgi-bin/calendar/calendar/add
	calID := fmt.Sprintf("mock-cal-%d", time.Now().UnixNano())
	log.Printf("[Mock WeCom] 创建日历事件: %s → %s", event.Summary, calID)
	return calID, nil
}

// updateCalendarEvent Mock 更新日历事件
func (s *CalendarSyncService) updateCalendarEvent(ctx context.Context, event *CalendarEvent) error {
	log.Printf("[Mock WeCom] 更新日历事件: %s → %s", event.Summary, event.CalID)
	return nil
}

// deleteCalendarEvent Mock 删除日历事件
func (s *CalendarSyncService) deleteCalendarEvent(ctx context.Context, calID string) error {
	log.Printf("[Mock WeCom] 删除日历事件: %s", calID)
	return nil
}

// HandleCalendarWebhook 处理企微日历变更 Webhook
func (s *CalendarSyncService) HandleCalendarWebhook(ctx context.Context, payload []byte) error {
	var webhook struct {
		CalID  string `json:"cal_id"`
		Action string `json:"action"` // created/updated/deleted
	}
	if err := json.Unmarshal(payload, &webhook); err != nil {
		return fmt.Errorf("webhook 解析失败: %w", err)
	}

	log.Printf("[Webhook] 日历事件变更: cal_id=%s action=%s", webhook.CalID, webhook.Action)

	// 反向查找 booking_id
	var bookingID string
	// 遍历 Redis keys 找到对应的 booking
	// Mock: 直接通过 cal_id 前缀匹配
	if webhook.Action == "deleted" {
		// 释放对应预约
		log.Printf("[Webhook] 日历事件被删除，需释放对应预约")
	}

	_ = bookingID
	return nil
}
