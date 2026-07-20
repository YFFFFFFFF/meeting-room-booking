package stats

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

// Dashboard GET /api/stats/dashboard
func (h *Handler) Dashboard(c *gin.Context) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var totalRooms int64
	h.db.Model(&model.MeetingRoom{}).Where("status = ?", "active").Count(&totalRooms)

	var todayBookings int64
	h.db.Model(&model.Booking{}).Where("start_time >= ? AND start_time < ?", todayStart, todayStart.Add(24*time.Hour)).Count(&todayBookings)

	// 当前占用
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

	// 楼层统计
	type FloorRow struct {
		Floor string
		Total int
	}
	var floors []FloorRow
	h.db.Model(&model.MeetingRoom{}).Select("floor, count(*) as total").
		Where("status = ?", "active").Group("floor").Scan(&floors)

	floorStats := make([]model.FloorStat, 0, len(floors))
	for _, f := range floors {
		var occupied int64
		h.db.Model(&model.Booking{}).
			Joins("JOIN meeting_rooms ON bookings.room_id = meeting_rooms.id").
			Where("meeting_rooms.floor = ? AND bookings.status IN ('confirmed','checked_in') AND bookings.start_time <= ? AND bookings.end_time > ?",
				f.Floor, now, now).
			Distinct("bookings.room_id").Count(&occupied)

		fUtil := 0.0
		if f.Total > 0 {
			fUtil = float64(occupied) / float64(f.Total) * 100
		}

		floorStats = append(floorStats, model.FloorStat{
			Floor:       f.Floor,
			Total:       f.Total,
			Occupied:    int(occupied),
			Utilization: fUtil,
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data: model.DashboardData{
			TotalRooms:        int(totalRooms),
			OccupiedRooms:     int(occupiedCount),
			FreeRooms:         int(freeRooms),
			TodayBookings:     todayBookings,
			CurrentUtilization: utilization,
			FloorStats:        floorStats,
		},
		RequestID: c.GetString("request_id"),
	})
}

// Utilization GET /api/stats/utilization
func (h *Handler) Utilization(c *gin.Context) {
	var rooms []model.MeetingRoom
	h.db.Where("status = ?", "active").Find(&rooms)

	reports := make([]model.UtilizationReport, 0, len(rooms))
	for _, room := range rooms {
		var total, cancelled int64
		h.db.Model(&model.Booking{}).Where("room_id = ?", room.ID).Count(&total)
		h.db.Model(&model.Booking{}).Where("room_id = ? AND status = 'cancelled'", room.ID).Count(&cancelled)

		utilization := 0.0
		if total > 0 {
			utilization = float64(total-cancelled) / float64(total) * 100
		}

		reports = append(reports, model.UtilizationReport{
			RoomID:             room.ID,
			RoomName:           room.Name,
			UtilizationRate:    utilization,
			TotalBookings:      total,
			CancelledBookings:  cancelled,
			AvgDurationMinutes: 45, // 默认值
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: reports, RequestID: c.GetString("request_id"),
	})
}

// Export GET /api/stats/export
func (h *Handler) Export(c *gin.Context) {
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=stats.xlsx")
	c.String(http.StatusOK, "Mock Excel Report Binary")
}
