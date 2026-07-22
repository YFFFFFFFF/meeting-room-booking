package bookings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/service"
)

type Handler struct {
	db              *repository.DB
	cache           *repository.Cache
	calendarService *service.CalendarSyncService
}

func NewHandler(db *repository.DB, cache *repository.Cache, calSvc *service.CalendarSyncService) *Handler {
	return &Handler{db: db, cache: cache, calendarService: calSvc}
}

// Create POST /api/bookings
func (h *Handler) Create(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	var req model.CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	startTime, err := time.Parse("2006-01-02T15:04:05", req.StartTime)
	if err != nil {
		startTime, err = time.Parse("2006-01-02T15:04:05Z", req.StartTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.ApiResponse{
				Code: 400, Message: "时间格式错误", Data: nil, RequestID: c.GetString("request_id"),
			})
			return
		}
	}
	endTime, err := time.Parse("2006-01-02T15:04:05", req.EndTime)
	if err != nil {
		endTime, err = time.Parse("2006-01-02T15:04:05Z", req.EndTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.ApiResponse{
				Code: 400, Message: "时间格式错误", Data: nil, RequestID: c.GetString("request_id"),
			})
			return
		}
	}

	// 获取会议室信息
	var room model.MeetingRoom
	if err := h.db.First(&room, "id = ?", req.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "会议室不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 分布式锁：防止并发创建同一时段同一会议室的预约
	lockKey := fmt.Sprintf("booking:lock:%s:%s:%s", req.RoomID, req.StartTime, req.EndTime)
	locked, err := h.cache.AcquireLock(c.Request.Context(), lockKey, 5*time.Second)
	if err == nil && locked {
		defer h.cache.ReleaseLock(c.Request.Context(), lockKey)
	}

	// 冲突检测
	var conflicts []model.Booking
	h.db.Where("room_id = ? AND status NOT IN ('cancelled','released') AND start_time < ? AND end_time > ?",
		req.RoomID, endTime, startTime).Find(&conflicts)

	if len(conflicts) > 0 {
		// 获取备选会议室
		var alternatives []model.MeetingRoom
		h.db.Where("id != ? AND status = 'active' AND capacity >= ?", req.RoomID, room.Capacity).
			Limit(3).Find(&alternatives)

		conflictInfo := model.ConflictInfo{
			HasConflict: true,
			ExistingBooking: &struct {
				OrganizerName string `json:"organizer_name"`
				Title         string `json:"title"`
				StartTime     string `json:"start_time"`
				EndTime       string `json:"end_time"`
			}{
				OrganizerName: getOrganizerName(h.db, conflicts[0].OrganizerID),
				Title:         conflicts[0].Title,
				StartTime:     conflicts[0].StartTime.Format("2006-01-02T15:04:05"),
				EndTime:       conflicts[0].EndTime.Format("2006-01-02T15:04:05"),
			},
			AlternativeRooms: alternatives,
		}

		c.JSON(http.StatusConflict, model.ApiResponse{
			Code:      409,
			Message:   "该时段已被占用",
			Data:      conflictInfo,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	// 确定状态
	status := model.BookingStatusConfirmed
	if room.Capacity > 20 {
		status = model.BookingStatusPending
	}

	equipmentJSON, _ := json.Marshal(req.EquipmentIDs)
	bookingID := generateID("bk")

	booking := model.Booking{
		ID:              bookingID,
		RoomID:          req.RoomID,
		OrganizerID:     userIDStr,
		Title:           req.Title,
		Agenda:          req.Agenda,
		StartTime:       startTime,
		EndTime:         endTime,
		Status:          status,
		EquipmentNeeded: string(equipmentJSON),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := h.db.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code: 500, Message: "创建失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 创建参会人记录
	for _, aid := range req.AttendeeIDs {
		attendee := model.Attendee{
			ID:        generateID("at"),
			BookingID: bookingID,
			UserID:    aid,
			Status:    "invited",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		h.db.Create(&attendee)
	}

	// 大会议室需要审批
	if status == model.BookingStatusPending {
		approval := model.Approval{
			ID:        generateID("ap"),
			BookingID: bookingID,
			Status:    "pending",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		h.db.Create(&approval)
	}

	msg := "预约成功"
	if status == model.BookingStatusPending {
		msg = "已提交审批，请等待管理员审核"
	}

	// 异步同步到企微日历（不阻塞响应）
	go func() {
		if err := h.calendarService.SyncBookingCreated(context.Background(), &booking); err != nil {
			// 日志已在 service 层记录
		}
	}()

	c.JSON(http.StatusCreated, model.ApiResponse{
		Code: 0, Message: msg,
		Data: bookingToResponse(booking, h.db),
		RequestID: c.GetString("request_id"),
	})
}

// Update PUT /api/bookings/:id
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")

	var booking model.Booking
	if err := h.db.First(&booking, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "预约不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	if booking.OrganizerID != userID.(string) {
		c.JSON(http.StatusForbidden, model.ApiResponse{
			Code: 403, Message: "只能修改自己的预约", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	var req model.UpdateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	updates := map[string]interface{}{}

	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Agenda != nil {
		updates["agenda"] = *req.Agenda
	}
	if req.RoomID != nil {
		updates["room_id"] = *req.RoomID
	}
	if req.StartTime != nil {
		t, err := time.Parse("2006-01-02T15:04:05", *req.StartTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.ApiResponse{
				Code: 400, Message: "开始时间格式错误", Data: nil, RequestID: c.GetString("request_id"),
			})
			return
		}
		updates["start_time"] = t
	}
	if req.EndTime != nil {
		t, err := time.Parse("2006-01-02T15:04:05", *req.EndTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.ApiResponse{
				Code: 400, Message: "结束时间格式错误", Data: nil, RequestID: c.GetString("request_id"),
			})
			return
		}
		updates["end_time"] = t
	}
	if req.EquipmentIDs != nil {
		equipmentJSON, _ := json.Marshal(req.EquipmentIDs)
		updates["equipment_needed"] = string(equipmentJSON)
	}

	// 如果修改了时间，检查冲突
	if req.StartTime != nil || req.EndTime != nil {
		newStart := booking.StartTime
		newEnd := booking.EndTime
		if req.StartTime != nil {
			newStart, _ = time.Parse("2006-01-02T15:04:05", *req.StartTime)
		}
		if req.EndTime != nil {
			newEnd, _ = time.Parse("2006-01-02T15:04:05", *req.EndTime)
		}

		var conflicts int64
		h.db.Model(&model.Booking{}).
			Where("id != ? AND room_id = ? AND status NOT IN ('cancelled','released') AND start_time < ? AND end_time > ?",
				id, booking.RoomID, newEnd, newStart).Count(&conflicts)

		if conflicts > 0 {
			c.JSON(http.StatusConflict, model.ApiResponse{
				Code: 409, Message: "修改后时间存在冲突", Data: nil, RequestID: c.GetString("request_id"),
			})
			return
		}
	}

	updates["updated_at"] = time.Now()
	h.db.Model(&booking).Updates(updates)
	h.db.First(&booking, "id = ?", id)

	// 异步同步日历更新
	go func() {
		h.calendarService.SyncBookingUpdated(context.Background(), &booking)
	}()

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "修改成功", Data: bookingToResponse(booking, h.db), RequestID: c.GetString("request_id"),
	})
}

// Cancel DELETE /api/bookings/:id
func (h *Handler) Cancel(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)
	role, _ := c.Get("role")

	var booking model.Booking
	if err := h.db.First(&booking, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "预约不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 权限校验：只有组织者本人或管理员可以取消
	if booking.OrganizerID != userIDStr && role != "admin" && role != "super_admin" {
		c.JSON(http.StatusForbidden, model.ApiResponse{
			Code: 403, Message: "只能取消自己的预约", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 检查是否已开始
	if booking.Status == "confirmed" && booking.StartTime.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "会议已开始，不可取消，请联系管理员", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&booking).Updates(map[string]interface{}{
		"status":         "cancelled",
		"release_reason": fmt.Sprintf("用户 %s 主动取消", userID),
		"updated_at":     time.Now(),
	})

	booking.Status = "cancelled"

	// 异步删除日历事件
	go func() {
		h.calendarService.SyncBookingCancelled(context.Background(), booking.ID)
	}()

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "取消成功", Data: bookingToResponse(booking, h.db), RequestID: c.GetString("request_id"),
	})
}

// Mine GET /api/bookings/mine
func (h *Handler) Mine(c *gin.Context) {
	userID, _ := c.Get("user_id")
	statusFilter := c.Query("status")
	page := 1
	pageSize := 20

	var bookings []model.Booking
	query := h.db.Where("organizer_id = ?", userID).Order("start_time DESC")

	if statusFilter != "" {
		query = query.Where("status IN (?)", splitStatus(statusFilter))
	}

	query.Find(&bookings)

	result := make([]model.BookingWithDetails, 0, len(bookings))
	for _, b := range bookings {
		result = append(result, bookingToResponse(b, h.db))
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success",
		Data: model.PaginatedData{
			Items:    result,
			Total:    int64(len(result)),
			Page:     page,
			PageSize: pageSize,
		},
		RequestID: c.GetString("request_id"),
	})
}

// Checkin POST /api/bookings/:id/checkin
func (h *Handler) Checkin(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	var booking model.Booking
	if err := h.db.First(&booking, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "预约不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 状态校验：只有 confirmed 状态可以签到
	if booking.Status != "confirmed" {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "当前状态不可签到", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 权限校验：只有组织者或参会人可以签到
	isAttendee := booking.OrganizerID == userIDStr
	if !isAttendee {
		var count int64
		h.db.Model(&model.Attendee{}).Where("booking_id = ? AND user_id = ?", id, userIDStr).Count(&count)
		isAttendee = count > 0
	}
	if !isAttendee {
		c.JSON(http.StatusForbidden, model.ApiResponse{
			Code: 403, Message: "只有会议参与人可以签到", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 时间窗口校验：会议开始前 15 分钟到结束前可签到
	now := time.Now()
	if now.Before(booking.StartTime.Add(-15 * time.Minute)) {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "签到尚未开放，请在会议开始前 15 分钟内签到", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}
	if now.After(booking.EndTime) {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "会议已结束，无法签到", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	// 防重复签到
	if booking.CheckinTime != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "已签到，无需重复操作", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&booking).Updates(map[string]interface{}{
		"status":       "checked_in",
		"checkin_time": now,
		"updated_at":   now,
	})

	booking.Status = "checked_in"
	booking.CheckinTime = &now

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "签到成功", Data: bookingToResponse(booking, h.db), RequestID: c.GetString("request_id"),
	})
}

func bookingToResponse(b model.Booking, db *repository.DB) model.BookingWithDetails {
	var room model.MeetingRoom
	var organizer model.User
	db.First(&room, "id = ?", b.RoomID)
	db.First(&organizer, "id = ?", b.OrganizerID)

	return model.BookingWithDetails{
		Booking:       b,
		RoomName:      room.Name,
		RoomFloor:     room.Floor,
		OrganizerName: organizer.Name,
	}
}

func getOrganizerName(db *repository.DB, userID string) string {
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		return ""
	}
	return user.Name
}

func splitStatus(s string) []string {
	var result []string
	current := ""
	for _, ch := range s {
		if ch == ',' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func randomStr(n int) string {
	b := make([]byte, n/2+1)
	rand.Read(b)
	return hex.EncodeToString(b)[:n]
}
