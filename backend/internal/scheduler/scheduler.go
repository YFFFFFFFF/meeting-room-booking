package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
)

// ReleaseNoShows 释放超时未签到的预约
func ReleaseNoShows(db *repository.DB) {
	now := time.Now()
	checkWindow := now.Add(-15 * time.Minute) // 开始后15分钟未签到

	var bookings []model.Booking
	db.Where("status = 'confirmed' AND start_time < ? AND checkin_time IS NULL", checkWindow).Find(&bookings)

	for _, b := range bookings {
		db.Model(&b).Updates(map[string]interface{}{
			"status":         "released",
			"release_reason": "超时未签到自动释放",
			"updated_at":     now,
		})
		log.Printf("🔄 释放超时预约: %s (%s)", b.Title, b.ID)
	}
}

// TimeoutApprovals 超时自动通过审批
func TimeoutApprovals(db *repository.DB) {
	var rules model.BookingRules
	db.First(&rules)

	timeout := time.Now().Add(-time.Duration(rules.ApprovalTimeoutHours) * time.Hour)

	var approvals []model.Approval
	db.Where("status = 'pending' AND created_at < ?", timeout).Find(&approvals)

	for _, a := range approvals {
		db.Model(&a).Updates(map[string]interface{}{
			"status":     "approved",
			"updated_at": time.Now(),
		})
		db.Model(&model.Booking{}).Where("id = ?", a.BookingID).Update("status", "confirmed")
		log.Printf("⏰ 审批超时自动通过: %s", a.ID)
	}
}

// Start 启动定时任务
func Start(db *repository.DB, ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Println("⏲️ 定时任务调度器已启动")

	for {
		select {
		case <-ticker.C:
			ReleaseNoShows(db)
			TimeoutApprovals(db)
		case <-ctx.Done():
			log.Println("⏲️ 定时任务调度器已停止")
			return
		}
	}
}
