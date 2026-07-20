package approvals

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

// Pending GET /api/approvals/pending
func (h *Handler) Pending(c *gin.Context) {
	var approvals []model.Approval
	h.db.Where("status = ?", "pending").Preload("Booking").Preload("Booking.Room").Preload("Booking.Organizer").Find(&approvals)

	type ApprovalResponse struct {
		ID             string `json:"id"`
		BookingID      string `json:"booking_id"`
		RoomName       string `json:"room_name"`
		Title          string `json:"title"`
		OrganizerName  string `json:"organizer_name"`
		StartTime      string `json:"start_time"`
		EndTime        string `json:"end_time"`
		AttendeesCount int    `json:"attendees_count"`
		Status         string `json:"status"`
		RejectReason   string `json:"reject_reason"`
		CreatedAt      string `json:"created_at"`
		UpdatedAt      string `json:"updated_at"`
	}

	result := make([]ApprovalResponse, 0, len(approvals))
	for _, a := range approvals {
		resp := ApprovalResponse{
			ID:            a.ID,
			BookingID:     a.BookingID,
			Status:        string(a.Status),
			RejectReason:  a.RejectReason,
			CreatedAt:     a.CreatedAt.Format("2006-01-02T15:04:05"),
			UpdatedAt:     a.UpdatedAt.Format("2006-01-02T15:04:05"),
		}
		if a.Booking != nil {
			resp.Title = a.Booking.Title
			resp.StartTime = a.Booking.StartTime.Format("2006-01-02T15:04:05")
			resp.EndTime = a.Booking.EndTime.Format("2006-01-02T15:04:05")
			if a.Booking.Room != nil {
				resp.RoomName = a.Booking.Room.Name
			}
			if a.Booking.Organizer != nil {
				resp.OrganizerName = a.Booking.Organizer.Name
			}
			var attendees []model.Attendee
			h.db.Where("booking_id = ?", a.BookingID).Find(&attendees)
			resp.AttendeesCount = len(attendees)
		}
		result = append(result, resp)
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: result, RequestID: c.GetString("request_id"),
	})
}

// Approve POST /api/approvals/:id/approve
func (h *Handler) Approve(c *gin.Context) {
	id := c.Param("id")

	var approval model.Approval
	if err := h.db.First(&approval, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "审批不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&approval).Updates(map[string]interface{}{
		"status":     "approved",
		"updated_at": time.Now(),
	})
	h.db.Model(&model.Booking{}).Where("id = ?", approval.BookingID).Update("status", "confirmed")

	approval.Status = "approved"
	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "已通过", Data: approval, RequestID: c.GetString("request_id"),
	})
}

// Reject POST /api/approvals/:id/reject
func (h *Handler) Reject(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)

	var approval model.Approval
	if err := h.db.First(&approval, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "审批不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&approval).Updates(map[string]interface{}{
		"status":        "rejected",
		"reject_reason": body.Reason,
		"updated_at":    time.Now(),
	})
	h.db.Model(&model.Booking{}).Where("id = ?", approval.BookingID).Update("status", "cancelled")

	approval.Status = "rejected"
	approval.RejectReason = body.Reason
	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "已驳回", Data: approval, RequestID: c.GetString("request_id"),
	})
}
