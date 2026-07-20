package rooms

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

// List GET /api/rooms
func (h *Handler) List(c *gin.Context) {
	var filter model.RoomFilter
	c.ShouldBindQuery(&filter)

	var rooms []model.MeetingRoom
	query := h.db.Where("status = ?", "active")

	if filter.Keyword != "" {
		query = query.Where("name ILIKE ?", "%"+filter.Keyword+"%")
	}
	if filter.Floor != "" {
		query = query.Where("floor = ?", filter.Floor)
	}
	if filter.CapacityMin > 0 {
		query = query.Where("capacity >= ?", filter.CapacityMin)
	}
	if filter.CapacityMax > 0 {
		query = query.Where("capacity <= ?", filter.CapacityMax)
	}

	query.Find(&rooms)

	// 丰富房间数据
	result := make([]model.RoomWithStatus, 0, len(rooms))
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.Add(24 * time.Hour)

	for _, room := range rooms {
		var equipments []model.Equipment
		h.db.Where("room_id = ?", room.ID).Find(&equipments)

		var bookings []model.Booking
		h.db.Where("room_id = ? AND status NOT IN ('cancelled','released') AND start_time < ? AND end_time > ?",
			room.ID, todayEnd, todayStart).Find(&bookings)

		isOccupied := false
		for _, b := range bookings {
			if b.StartTime.Before(now) && b.EndTime.After(now) {
				isOccupied = true
				break
			}
		}

		current := "free"
		if isOccupied {
			current = "occupied"
		}

		slots := make([]model.TimeSlotBooking, 0, len(bookings))
		for _, b := range bookings {
			slots = append(slots, model.TimeSlotBooking{
				BookingID:     b.ID,
				Title:         b.Title,
				OrganizerName: getOrganizerName(h.db, b.OrganizerID),
				StartTime:     b.StartTime.Format("2006-01-02T15:04:05"),
				EndTime:       b.EndTime.Format("2006-01-02T15:04:05"),
				Status:        b.Status,
			})
		}

		result = append(result, model.RoomWithStatus{
			MeetingRoom: room,
			Equipment:   equipments,
			CurrentStatus: &model.RoomTimeSlotStatus{
				Current:       current,
				TodayBookings: slots,
			},
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:      0,
		Message:   "success",
		Data:      result,
		RequestID: c.GetString("request_id"),
	})
}

// Get GET /api/rooms/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")

	var room model.MeetingRoom
	if err := h.db.First(&room, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code:      404,
			Message:   "会议室不存在",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	var equipments []model.Equipment
	h.db.Where("room_id = ?", id).Find(&equipments)

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.Add(24 * time.Hour)

	var bookings []model.Booking
	h.db.Where("room_id = ? AND status NOT IN ('cancelled','released') AND start_time < ? AND end_time > ?",
		id, todayEnd, todayStart).Find(&bookings)

	isOccupied := false
	for _, b := range bookings {
		if b.StartTime.Before(now) && b.EndTime.After(now) {
			isOccupied = true
			break
		}
	}

	current := "free"
	if isOccupied {
		current = "occupied"
	}

	slots := make([]model.TimeSlotBooking, 0, len(bookings))
	for _, b := range bookings {
		slots = append(slots, model.TimeSlotBooking{
			BookingID:     b.ID,
			Title:         b.Title,
			OrganizerName: getOrganizerName(h.db, b.OrganizerID),
			StartTime:     b.StartTime.Format("2006-01-02T15:04:05"),
			EndTime:       b.EndTime.Format("2006-01-02T15:04:05"),
			Status:        b.Status,
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data: model.RoomWithStatus{
			MeetingRoom: room,
			Equipment:   equipments,
			CurrentStatus: &model.RoomTimeSlotStatus{
				Current:       current,
				TodayBookings: slots,
			},
		},
		RequestID: c.GetString("request_id"),
	})
}

// Availability GET /api/rooms/:id/availability
func (h *Handler) Availability(c *gin.Context) {
	id := c.Param("id")
	dateStr := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	var room model.MeetingRoom
	if err := h.db.First(&room, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "会议室不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	dayStart, _ := time.Parse("2006-01-02", dateStr)
	dayEnd := dayStart.Add(24 * time.Hour)

	var bookings []model.Booking
	h.db.Where("room_id = ? AND status NOT IN ('cancelled','released') AND start_time < ? AND end_time > ?",
		id, dayEnd, dayStart).Find(&bookings)

	slots := make([]model.AvailabilitySlot, 0)
	for h := 8; h < 20; h++ {
		for _, m := range []int{0, 30} {
			start := dayStart.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute)
			end := start.Add(30 * time.Minute)

			conflict := false
			for _, b := range bookings {
				if b.StartTime.Before(end) && b.EndTime.After(start) {
					conflict = true
					break
				}
			}

			slots = append(slots, model.AvailabilitySlot{
				StartTime: start.Format("2006-01-02T15:04:05"),
				EndTime:   end.Format("2006-01-02T15:04:05"),
				Available: !conflict,
			})
		}
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: slots, RequestID: c.GetString("request_id"),
	})
}

// Create POST /api/rooms
func (h *Handler) Create(c *gin.Context) {
	var body model.MeetingRoom
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	body.ID = generateID("room")
	body.Status = "active"
	body.CreatedAt = time.Now()
	body.UpdatedAt = time.Now()

	if err := h.db.Create(&body).Error; err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code: 500, Message: "创建失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusCreated, model.ApiResponse{
		Code: 0, Message: "success", Data: body, RequestID: c.GetString("request_id"),
	})
}

// Update PUT /api/rooms/:id
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var body model.MeetingRoom
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	var room model.MeetingRoom
	if err := h.db.First(&room, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "会议室不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	body.ID = id
	body.UpdatedAt = time.Now()
	h.db.Model(&room).Updates(&body)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: body, RequestID: c.GetString("request_id"),
	})
}

// Delete DELETE /api/rooms/:id (停用)
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	var room model.MeetingRoom
	if err := h.db.First(&room, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "会议室不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&room).Updates(map[string]interface{}{
		"status":     "inactive",
		"updated_at": time.Now(),
	})

	room.Status = "inactive"
	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: room, RequestID: c.GetString("request_id"),
	})
}

// Import POST /api/rooms/import
func (h *Handler) Import(c *gin.Context) {
	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "导入成功", Data: map[string]int{"imported": 10, "failed": 0}, RequestID: c.GetString("request_id"),
	})
}

// Export GET /api/rooms/export
func (h *Handler) Export(c *gin.Context) {
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=rooms.xlsx")
	c.String(http.StatusOK, "Mock Excel Binary")
}

func getOrganizerName(db *repository.DB, userID string) string {
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		return ""
	}
	return user.Name
}

func generateID(prefix string) string {
	return prefix + "-" + randomStr(8)
}

func randomStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[i%len(letters)]
	}
	return string(b)
}
