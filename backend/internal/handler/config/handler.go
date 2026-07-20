package config

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
)

type Handler struct {
	db    *repository.DB
	cache *repository.Cache
}

func NewHandler(db *repository.DB, cache *repository.Cache) *Handler {
	return &Handler{db: db, cache: cache}
}

// GetBookingRules GET /api/config/booking-rules
func (h *Handler) GetBookingRules(c *gin.Context) {
	var rules model.BookingRules
	if err := h.db.First(&rules).Error; err != nil {
		// 返回默认规则
		rules = model.BookingRules{
			MaxAdvanceDays:        30,
			LatestBookingMinutes:  15,
			MinDurationMinutes:    15,
			MaxDurationMinutes:    240,
			MaxDailyBookings:      5,
			SmallRoomMinAttendees: 1,
			MediumRoomMinAttendees: 3,
			LargeRoomMinAttendees: 10,
			LargeRoomThreshold:    20,
			ApprovalTimeoutHours:  24,
		}
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: rules, RequestID: c.GetString("request_id"),
	})
}

// UpdateBookingRules PUT /api/config/booking-rules
func (h *Handler) UpdateBookingRules(c *gin.Context) {
	var body model.BookingRules
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	var rules model.BookingRules
	if err := h.db.First(&rules).Error; err != nil {
		// 创建新规则
		h.db.Create(&body)
	} else {
		h.db.Model(&rules).Updates(&body)
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "规则更新成功，即时生效", Data: body, RequestID: c.GetString("request_id"),
	})
}

// GetFloors GET /api/config/floors
func (h *Handler) GetFloors(c *gin.Context) {
	var floors []string
	h.db.Model(&model.MeetingRoom{}).Where("status = ?", "active").
		Distinct("floor").Order("floor").Pluck("floor", &floors)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: floors, RequestID: c.GetString("request_id"),
	})
}

// GetEquipmentTypes GET /api/config/equipment-types
func (h *Handler) GetEquipmentTypes(c *gin.Context) {
	types := []map[string]string{
		{"value": "projector", "label": "投影仪"},
		{"value": "tv", "label": "电视屏幕"},
		{"value": "vc_terminal", "label": "视频会议终端"},
		{"value": "mic", "label": "麦克风"},
		{"value": "speaker", "label": "音响"},
		{"value": "whiteboard", "label": "白板"},
		{"value": "dock", "label": "扩展坞"},
		{"value": "adapter", "label": "转接头"},
		{"value": "phone", "label": "会议电话"},
	}

	_ = time.Now() // used in real implementation

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: types, RequestID: c.GetString("request_id"),
	})
}
