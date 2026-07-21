package rooms

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/service"
)

type Handler struct {
	db           *repository.DB
	cache        *repository.Cache
	cacheService *service.CacheService
}

func NewHandler(db *repository.DB, cache *repository.Cache, cacheSvc *service.CacheService) *Handler {
	return &Handler{db: db, cache: cache, cacheService: cacheSvc}
}

// List GET /api/rooms
func (h *Handler) List(c *gin.Context) {
	var filter model.RoomFilter
	c.ShouldBindQuery(&filter)

	var rooms []model.MeetingRoom
	query := h.db.Where("status = ?", "active")

	// 无筛选条件时使用缓存
	noFilter := filter.Keyword == "" && filter.Floor == "" && filter.CapacityMin == 0 && filter.CapacityMax == 0 && len(filter.EquipmentTypes) == 0
	if noFilter {
		cached, err := h.cacheService.GetRoomsWithCache(c.Request.Context())
		if err == nil && len(cached) > 0 {
			rooms = cached
			goto enrich
		}
	}

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

enrich:
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

	// 清除缓存
	go h.cacheService.InvalidateRoomCache(c.Request.Context())

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

	go h.cacheService.InvalidateRoomCache(c.Request.Context())

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

	go h.cacheService.InvalidateRoomCache(c.Request.Context())

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: room, RequestID: c.GetString("request_id"),
	})
}

// Import POST /api/rooms/import
func (h *Handler) Import(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "请上传文件", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}
	defer file.Close()

	// 读取文件内容
	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "读取文件失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	f, err := excelize.OpenReader(strings.NewReader(string(data)))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "无法解析 Excel 文件: " + err.Error(), Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}
	defer f.Close()

	rows, err := f.GetRows(f.GetSheetName(0))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "读取工作表失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "文件为空或缺少数据行", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	type ImportError struct {
		Row    int    `json:"row"`
		Reason string `json:"reason"`
	}

	imported := 0
	failed := 0
	errors := make([]ImportError, 0)

	// 跳过表头，从第2行开始
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) < 4 {
			errors = append(errors, ImportError{Row: i + 1, Reason: "列数不足"})
			failed++
			continue
		}

		name := strings.TrimSpace(row[0])
		floor := strings.TrimSpace(row[1])
		building := strings.TrimSpace(row[2])
		capacityStr := strings.TrimSpace(row[3])
		roomType := "medium"
		if len(row) > 4 {
			roomType = strings.TrimSpace(row[4])
		}

		if name == "" {
			errors = append(errors, ImportError{Row: i + 1, Reason: "会议室名称不能为空"})
			failed++
			continue
		}

		capacity, err := strconv.Atoi(capacityStr)
		if err != nil || capacity <= 0 {
			errors = append(errors, ImportError{Row: i + 1, Reason: "容量必须大于0"})
			failed++
			continue
		}

		if building == "" {
			building = "A栋"
		}
		if roomType == "" || (roomType != "small" && roomType != "medium" && roomType != "large") {
			roomType = "medium"
		}

		// 检查名称是否重复
		var existing int64
		h.db.Model(&model.MeetingRoom{}).Where("name = ? AND status = 'active'", name).Count(&existing)
		if existing > 0 {
			errors = append(errors, ImportError{Row: i + 1, Reason: "会议室名称重复"})
			failed++
			continue
		}

		now := time.Now()
		room := model.MeetingRoom{
			ID:           generateID("room"),
			Name:         name,
			Floor:        floor,
			Building:     building,
			Capacity:     capacity,
			RoomType:     model.RoomType(roomType),
			Status:       "active",
			LocationDesc: fmt.Sprintf("%s%s", floor, building),
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if err := h.db.Create(&room).Error; err != nil {
			errors = append(errors, ImportError{Row: i + 1, Reason: "创建失败: " + err.Error()})
			failed++
			continue
		}

		imported++
	}

	// 清除缓存
	go h.cacheService.InvalidateRoomCache(c.Request.Context())

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: fmt.Sprintf("导入完成：成功 %d 条，失败 %d 条", imported, failed),
		Data: map[string]interface{}{
			"imported": imported,
			"failed":   failed,
			"errors":   errors,
		},
		RequestID: c.GetString("request_id"),
	})
}

// Export GET /api/rooms/export
func (h *Handler) Export(c *gin.Context) {
	var rooms []model.MeetingRoom
	h.db.Order("floor, name").Find(&rooms)

	f := excelize.NewFile()
	defer f.Close()

	sheet := "会议室列表"
	f.SetSheetName("Sheet1", sheet)

	// 表头
	headers := []string{"名称", "楼层", "楼栋", "容量", "类型", "状态", "位置描述"}
	for i, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, hdr)
	}

	// 设置表头样式
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 12},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E2E8F0"}, Pattern: 1},
	})
	f.SetCellStyle(sheet, "A1", fmt.Sprintf("%c1", 'A'+len(headers)-1), headerStyle)

	// 数据行
	typeLabels := map[model.RoomType]string{
		model.RoomTypeSmall:  "小（≤6人）",
		model.RoomTypeMedium: "中（7-20人）",
		model.RoomTypeLarge:  "大（>20人）",
	}
	statusLabels := map[model.RoomStatus]string{
		"active":      "可用",
		"inactive":    "已停用",
		"maintenance": "维护中",
	}

	for i, room := range rooms {
		row := i + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), room.Name)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), room.Floor)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), room.Building)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), room.Capacity)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), typeLabels[room.RoomType])
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), statusLabels[room.Status])
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), room.LocationDesc)
	}

	// 设置列宽
	f.SetColWidth(sheet, "A", "A", 20)
	f.SetColWidth(sheet, "B", "B", 8)
	f.SetColWidth(sheet, "C", "C", 8)
	f.SetColWidth(sheet, "D", "D", 8)
	f.SetColWidth(sheet, "E", "E", 15)
	f.SetColWidth(sheet, "F", "F", 10)
	f.SetColWidth(sheet, "G", "G", 25)

	buf, err := f.WriteToBuffer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code: 500, Message: "生成 Excel 失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", "会议室列表.xlsx"))
	c.Header("Content-Length", fmt.Sprintf("%d", len(buf.Bytes())))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

func getOrganizerName(db *repository.DB, userID string) string {
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		return ""
	}
	return user.Name
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}
