package stats

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
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

// Dashboard GET /api/stats/dashboard
func (h *Handler) Dashboard(c *gin.Context) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var totalRooms int64
	h.db.Model(&model.MeetingRoom{}).Where("status = ?", "active").Count(&totalRooms)

	var todayBookings int64
	h.db.Model(&model.Booking{}).Where("start_time >= ? AND start_time < ?", todayStart, todayStart.Add(24*time.Hour)).Count(&todayBookings)

	var occupiedCount int64
	h.db.Model(&model.Booking{}).
		Where("status IN ('confirmed','checked_in') AND start_time <= ? AND end_time > ?", now, now).
		Distinct("room_id").Count(&occupiedCount)

	freeRooms := totalRooms - occupiedCount
	if freeRooms < 0 {
		freeRooms = 0
	}

	utilization := 0.0
	if totalRooms > 0 {
		utilization = float64(occupiedCount) / float64(totalRooms) * 100
	}

	type FloorRow struct {
		Floor string
		Total int
	}
	var floors []FloorRow
	h.db.Model(&model.MeetingRoom{}).Select("floor, count(*) as total").
		Where("status = ?", "active").Group("floor").Scan(&floors)

	// 一次性查询各楼层占用情况（避免 N+1）
	type FloorOccRow struct {
		Floor    string
		Occupied int64
	}
	var floorOccs []FloorOccRow
	h.db.Model(&model.Booking{}).
		Select("meeting_rooms.floor, COUNT(DISTINCT bookings.room_id) as occupied").
		Joins("JOIN meeting_rooms ON bookings.room_id = meeting_rooms.id").
		Where("bookings.status IN ('confirmed','checked_in') AND bookings.start_time <= ? AND bookings.end_time > ?", now, now).
		Group("meeting_rooms.floor").
		Scan(&floorOccs)

	occMap := make(map[string]int64, len(floorOccs))
	for _, fo := range floorOccs {
		occMap[fo.Floor] = fo.Occupied
	}

	floorStats := make([]model.FloorStat, 0, len(floors))
	for _, f := range floors {
		occupied := occMap[f.Floor]
		fUtil := 0.0
		if f.Total > 0 {
			fUtil = float64(occupied) / float64(f.Total) * 100
		}
		floorStats = append(floorStats, model.FloorStat{
			Floor: f.Floor, Total: f.Total, Occupied: int(occupied), Utilization: fUtil,
		})
	}

	// 按类型统计（一次查询）
	type TypeStat struct {
		Type        string  `json:"type"`
		Total       int     `json:"total"`
		Occupied    int     `json:"occupied"`
		Utilization float64 `json:"utilization"`
	}
	type TypeOccRow struct {
		RoomType string
		Occupied int64
	}
	var typeOccs []TypeOccRow
	h.db.Model(&model.Booking{}).
		Select("meeting_rooms.room_type, COUNT(DISTINCT bookings.room_id) as occupied").
		Joins("JOIN meeting_rooms ON bookings.room_id = meeting_rooms.id").
		Where("bookings.status IN ('confirmed','checked_in') AND bookings.start_time <= ? AND bookings.end_time > ?", now, now).
		Group("meeting_rooms.room_type").
		Scan(&typeOccs)

	typeOccMap := make(map[string]int64, len(typeOccs))
	for _, to := range typeOccs {
		typeOccMap[to.RoomType] = to.Occupied
	}

	typeStats := make([]TypeStat, 0)
	for _, rt := range []model.RoomType{model.RoomTypeSmall, model.RoomTypeMedium, model.RoomTypeLarge} {
		var total int64
		h.db.Model(&model.MeetingRoom{}).Where("status = 'active' AND room_type = ?", rt).Count(&total)
		occ := typeOccMap[string(rt)]
		u := 0.0
		if total > 0 {
			u = float64(occ) / float64(total) * 100
		}
		typeStats = append(typeStats, TypeStat{Type: string(rt), Total: int(total), Occupied: int(occ), Utilization: u})
	}

	// 趋势数据（近7天）
	trendData := h.buildTrendData(now)

	// 热门会议室 Top 5
	hotRooms := h.buildHotRooms(now)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0, Message: "success",
		Data: map[string]interface{}{
			"total_rooms":         totalRooms,
			"occupied_rooms":      occupiedCount,
			"free_rooms":          freeRooms,
			"today_bookings":      todayBookings,
			"current_utilization": utilization,
			"floor_stats":         floorStats,
			"type_stats":          typeStats,
			"trend":               trendData,
			"top_rooms":           hotRooms,
		},
		RequestID: c.GetString("request_id"),
	})
}

// buildTrendData 构建近7天趋势数据
func (h *Handler) buildTrendData(now time.Time) []map[string]interface{} {
	days := 7
	startDate := now.AddDate(0, 0, -days+1)
	dayStart := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())

	trends := make([]map[string]interface{}, 0, days)
	for i := 0; i < days; i++ {
		d := dayStart.AddDate(0, 0, i)
		dEnd := d.Add(24 * time.Hour)
		dateStr := d.Format("01-02")

		var total int64
		h.db.Model(&model.Booking{}).Where("start_time >= ? AND start_time < ?", d, dEnd).Count(&total)

		var occupied int64
		h.db.Model(&model.Booking{}).
			Where("status NOT IN ('cancelled','released') AND start_time >= ? AND start_time < ?", d, dEnd).
			Count(&occupied)

		utilRate := 0.0
		var totalRooms int64
		h.db.Model(&model.MeetingRoom{}).Where("status = 'active'").Count(&totalRooms)
		if totalRooms > 0 {
			utilRate = float64(occupied) / float64(totalRooms) * 100
		}

		trends = append(trends, map[string]interface{}{
			"date":        dateStr,
			"bookings":    total,
			"utilization": utilRate,
		})
	}
	return trends
}

// buildHotRooms 构建热门会议室 Top 5
func (h *Handler) buildHotRooms(now time.Time) []map[string]interface{} {
	startTime := now.AddDate(0, -1, 0)
	endTime := now

	type HotRoom struct {
		RoomID       string
		RoomName     string
		Floor        string
		BookingCount int64
		TotalHours   float64
	}

	var results []HotRoom
	h.db.Model(&model.Booking{}).
		Select("bookings.room_id, meeting_rooms.name as room_name, meeting_rooms.floor, count(*) as booking_count, COALESCE(SUM(EXTRACT(EPOCH FROM bookings.end_time - bookings.start_time)/3600), 0) as total_hours").
		Joins("JOIN meeting_rooms ON bookings.room_id = meeting_rooms.id").
		Where("bookings.start_time >= ? AND bookings.start_time < ? AND bookings.status != 'cancelled' AND bookings.status != 'released'",
			startTime, endTime).
		Group("bookings.room_id, meeting_rooms.name, meeting_rooms.floor").
		Order("booking_count DESC").
		Limit(5).
		Scan(&results)

	totalHours := endTime.Sub(startTime).Hours()
	hotRooms := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		utilRate := 0.0
		if totalHours > 0 {
			utilRate = r.TotalHours / totalHours * 100
		}
		hotRooms = append(hotRooms, map[string]interface{}{
			"room_id":          r.RoomID,
			"room_name":        r.RoomName,
			"floor":            r.Floor,
			"booking_count":    r.BookingCount,
			"utilization_rate": utilRate,
		})
	}
	return hotRooms
}

// Utilization GET /api/stats/utilization
func (h *Handler) Utilization(c *gin.Context) {
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	startTime, _ := time.Parse("2006-01-02", startDate)
	endTime, _ := time.Parse("2006-01-02", endDate)
	endTime = endTime.Add(24 * time.Hour)

	var rooms []model.MeetingRoom
	h.db.Where("status = ?", "active").Find(&rooms)

	reports := make([]model.UtilizationReport, 0, len(rooms))
	for _, room := range rooms {
		var total, cancelled int64
		h.db.Model(&model.Booking{}).Where("room_id = ? AND start_time >= ? AND start_time < ?", room.ID, startTime, endTime).Count(&total)
		h.db.Model(&model.Booking{}).Where("room_id = ? AND status = 'cancelled' AND start_time >= ? AND start_time < ?", room.ID, startTime, endTime).Count(&cancelled)

		// 计算平均时长
		var avgDuration float64
		h.db.Model(&model.Booking{}).
			Select("COALESCE(AVG(EXTRACT(EPOCH FROM end_time - start_time)/60), 0)").
			Where("room_id = ? AND start_time >= ? AND start_time < ?", room.ID, startTime, endTime).
			Scan(&avgDuration)

		utilization := 0.0
		if total > 0 {
			utilization = float64(total-cancelled) / float64(total) * 100
		}

		reports = append(reports, model.UtilizationReport{
			RoomID: room.ID, RoomName: room.Name,
			UtilizationRate: utilization, TotalBookings: total,
			CancelledBookings: cancelled, AvgDurationMinutes: avgDuration,
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: reports, RequestID: c.GetString("request_id"),
	})
}

// Trend GET /api/stats/trend — 预约趋势（按天统计）
func (h *Handler) Trend(c *gin.Context) {
	days := 7
	now := time.Now()
	startDate := now.AddDate(0, 0, -days+1)
	dayStart := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())

	type DayTrend struct {
		Date    string `json:"date"`
		Total   int64  `json:"total"`
		Created int64  `json:"created"`
		Cancelled int64 `json:"cancelled"`
	}

	trends := make([]DayTrend, 0, days)
	for i := 0; i < days; i++ {
		d := dayStart.AddDate(0, 0, i)
		dEnd := d.Add(24 * time.Hour)
		dateStr := d.Format("2006-01-02")

		var total, created, cancelled int64
		h.db.Model(&model.Booking{}).Where("start_time >= ? AND start_time < ?", d, dEnd).Count(&total)
		h.db.Model(&model.Booking{}).Where("created_at >= ? AND created_at < ?", d, dEnd).Count(&created)
		h.db.Model(&model.Booking{}).Where("status = 'cancelled' AND updated_at >= ? AND updated_at < ?", d, dEnd).Count(&cancelled)

		trends = append(trends, DayTrend{Date: dateStr, Total: total, Created: created, Cancelled: cancelled})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: trends, RequestID: c.GetString("request_id"),
	})
}

// HotRooms GET /api/stats/hot-rooms — 热门会议室排行
func (h *Handler) HotRooms(c *gin.Context) {
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	limit := 5

	startTime, _ := time.Parse("2006-01-02", startDate)
	endTime, _ := time.Parse("2006-01-02", endDate)
	endTime = endTime.Add(24 * time.Hour)

	type HotRoom struct {
		RoomID          string  `json:"room_id"`
		RoomName        string  `json:"room_name"`
		Floor           string  `json:"floor"`
		BookingCount    int64   `json:"booking_count"`
		UtilizationRate float64 `json:"utilization_rate"`
		TotalHours      float64 `json:"total_hours"`
	}

	var results []HotRoom
	h.db.Model(&model.Booking{}).
		Select("bookings.room_id, meeting_rooms.name as room_name, meeting_rooms.floor, count(*) as booking_count, COALESCE(SUM(EXTRACT(EPOCH FROM bookings.end_time - bookings.start_time)/3600), 0) as total_hours").
		Joins("JOIN meeting_rooms ON bookings.room_id = meeting_rooms.id").
		Where("bookings.start_time >= ? AND bookings.start_time < ? AND bookings.status != 'cancelled' AND bookings.status != 'released'",
			startTime, endTime).
		Group("bookings.room_id, meeting_rooms.name, meeting_rooms.floor").
		Order("booking_count DESC").
		Limit(limit).
		Scan(&results)

	// 计算利用率
	totalHours := endTime.Sub(startTime).Hours()
	for i := range results {
		if totalHours > 0 {
			results[i].UtilizationRate = results[i].TotalHours / totalHours * 100
		}
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: results, RequestID: c.GetString("request_id"),
	})
}

// PeakHours GET /api/stats/peak-hours — 高峰时段分析
func (h *Handler) PeakHours(c *gin.Context) {
	type HourStat struct {
		Hour  int   `json:"hour"`
		Count int64 `json:"count"`
	}

	stats := make([]HourStat, 0, 24)
	for hour := 0; hour < 24; hour++ {
		start := fmt.Sprintf("%02d:00", hour)
		end := fmt.Sprintf("%02d:59", hour)
		var count int64
		h.db.Model(&model.Booking{}).
			Where("status NOT IN ('cancelled','released') AND TO_CHAR(start_time, 'HH24:MI') >= ? AND TO_CHAR(start_time, 'HH24:MI') <= ?",
				start, end).
			Count(&count)
		stats = append(stats, HourStat{Hour: hour, Count: count})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: stats, RequestID: c.GetString("request_id"),
	})
}

// Export GET /api/stats/export
func (h *Handler) Export(c *gin.Context) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "数据报表"
	f.SetSheetName("Sheet1", sheet)

	// 表头
	headers := []string{"会议室", "利用率(%)", "总预约数", "取消数", "平均时长(分钟)"}
	for i, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, hdr)
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 12},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E2E8F0"}, Pattern: 1},
	})
	f.SetCellStyle(sheet, "A1", "E1", headerStyle)

	// 获取利用率数据
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now().Add(24 * time.Hour)

	var rooms []model.MeetingRoom
	h.db.Where("status = ?", "active").Find(&rooms)

	for i, room := range rooms {
		var total, cancelled int64
		h.db.Model(&model.Booking{}).Where("room_id = ? AND start_time >= ? AND start_time < ?", room.ID, startDate, endDate).Count(&total)
		h.db.Model(&model.Booking{}).Where("room_id = ? AND status = 'cancelled' AND start_time >= ? AND start_time < ?", room.ID, startDate, endDate).Count(&cancelled)

		var avgDuration float64
		h.db.Model(&model.Booking{}).
			Select("COALESCE(AVG(EXTRACT(EPOCH FROM end_time - start_time)/60), 0)").
			Where("room_id = ? AND start_time >= ? AND start_time < ?", room.ID, startDate, endDate).
			Scan(&avgDuration)

		utilization := 0.0
		if total > 0 {
			utilization = float64(total-cancelled) / float64(total) * 100
		}

		row := i + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), room.Name)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), fmt.Sprintf("%.1f", utilization))
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), total)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), cancelled)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), fmt.Sprintf("%.0f", avgDuration))
	}

	f.SetColWidth(sheet, "A", "A", 20)
	f.SetColWidth(sheet, "B", "E", 15)

	buf, err := f.WriteToBuffer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code: 500, Message: "生成 Excel 失败", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	filename := fmt.Sprintf("数据报表_%s.xlsx", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}
