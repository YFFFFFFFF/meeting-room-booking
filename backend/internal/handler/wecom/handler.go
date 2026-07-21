package wecom

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

// GetToken GET /api/wecom/gettoken (Mock)
func (h *Handler) GetToken(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode":     0,
		"errmsg":      "ok",
		"access_token": "mock-wecom-access-token",
		"expires_in":  7200,
	})
}

// GetUserInfo GET /api/wecom/user/getuserinfo (Mock)
func (h *Handler) GetUserInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode":  0,
		"errmsg":   "ok",
		"UserId":   "zhiniu",
		"DeviceId": "mock-device",
	})
}

// GetUser GET /api/wecom/user/get (Mock)
func (h *Handler) GetUser(c *gin.Context) {
	userID := c.Query("userid")
	var user model.User
	if err := h.db.Where("wecom_user_id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"errcode": 60111,
			"errmsg":  "userid not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"errcode":         0,
		"errmsg":          "ok",
		"userid":          user.WecomUserID,
		"name":            user.Name,
		"department":      []int{1},
		"order":           []int{1},
		"position":        "员工",
		"mobile":          "13800138000",
		"gender":          "1",
		"email":           user.WecomUserID + "@company.com",
		"avatar":          user.Avatar,
		"status":          1,
		"main_department": 1,
	})
}

// DepartmentList GET /api/wecom/department/list (Mock)
func (h *Handler) DepartmentList(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode": 0,
		"errmsg":  "ok",
		"department": []gin.H{
			{"id": 1, "name": "公司总部", "parentid": 0},
			{"id": 2, "name": "技术部", "parentid": 1},
			{"id": 3, "name": "产品部", "parentid": 1},
			{"id": 4, "name": "市场部", "parentid": 1},
			{"id": 5, "name": "设计部", "parentid": 1},
			{"id": 6, "name": "行政部", "parentid": 1},
			{"id": 7, "name": "财务部", "parentid": 1},
			{"id": 8, "name": "IT部", "parentid": 1},
		},
	})
}

// SimpleList GET /api/wecom/user/simplelist (Mock)
func (h *Handler) SimpleList(c *gin.Context) {
	var users []model.User
	h.db.Where("status = ?", "active").Find(&users)

	type Member struct {
		UserID     string `json:"userid"`
		Name       string `json:"name"`
		Department string `json:"department"`
		Avatar     string `json:"avatar"`
	}

	members := make([]Member, 0, len(users))
	for _, u := range users {
		members = append(members, Member{
			UserID:     u.WecomUserID,
			Name:       u.Name,
			Department: u.Department,
			Avatar:     u.Avatar,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"errcode":  0,
		"errmsg":   "ok",
		"userlist": members,
	})
}

// SendMessage POST /api/wecom/message/send (Mock)
func (h *Handler) SendMessage(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode":      0,
		"errmsg":       "ok",
		"invaliduser":  "",
		"invalidparty": "",
		"invalidtag":   "",
	})
}

// SendTemplateCard POST /api/wecom/message/send_template_card (Mock)
func (h *Handler) SendTemplateCard(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode": 0,
		"errmsg":  "ok",
	})
}

// CalendarAdd POST /api/wecom/calendar/add (Mock)
func (h *Handler) CalendarAdd(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode": 0,
		"errmsg":  "ok",
		"cal_id":  "mock-cal-event-id",
	})
}

// CalendarUpdate POST /api/wecom/calendar/update (Mock)
func (h *Handler) CalendarUpdate(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode": 0,
		"errmsg":  "ok",
	})
}

// CalendarDelete POST /api/wecom/calendar/delete (Mock)
func (h *Handler) CalendarDelete(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode": 0,
		"errmsg":  "ok",
	})
}

// GetJsapiTicket GET /api/wecom/get_jsapi_ticket (Mock)
func (h *Handler) GetJsapiTicket(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode":    0,
		"errmsg":     "ok",
		"ticket":     "mock-jsapi-ticket",
		"expires_in": 7200,
	})
}

// GetAppTicket GET /api/wecom/ticket/get (Mock)
func (h *Handler) GetAppTicket(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"errcode":    0,
		"errmsg":     "ok",
		"ticket":     "mock-app-ticket",
		"expires_in": 7200,
	})
}

// ========== 日程同步 API（后端内部） ==========

// CalendarEvents GET /api/wecom/calendar/events — 获取已同步的日程列表
func (h *Handler) CalendarEvents(c *gin.Context) {
	// 查询所有预约中已同步到企微日历的记录
	type CalendarEvent struct {
		ID          string   `json:"id"`
		BookingID   string   `json:"booking_id"`
		CalID       *string  `json:"cal_id"`
		Title       string   `json:"title"`
		StartTime   string   `json:"start_time"`
		EndTime     string   `json:"end_time"`
		Attendees   []string `json:"attendees"`
		SyncStatus  string   `json:"sync_status"`
		SyncedAt    *string  `json:"synced_at"`
		SyncError   *string  `json:"sync_error"`
	}

	var bookings []model.Booking
	h.db.Where("status NOT IN ('cancelled','released')").Order("start_time DESC").Limit(50).Find(&bookings)

	events := make([]CalendarEvent, 0, len(bookings))
	for _, b := range bookings {
		var attendees []model.Attendee
		h.db.Where("booking_id = ?", b.ID).Find(&attendees)
		attendeeIDs := make([]string, 0, len(attendees))
		for _, a := range attendees {
			attendeeIDs = append(attendeeIDs, a.UserID)
		}

		// Mock 同步状态：大部分为 synced
		syncStatus := "synced"
		var syncedAt *string
		nowStr := time.Now().Add(-1 * time.Hour).Format(time.RFC3339)
		syncedAt = &nowStr

		events = append(events, CalendarEvent{
			ID:         "evt-" + b.ID,
			BookingID:  b.ID,
			CalID:      nil,
			Title:      b.Title,
			StartTime:  b.StartTime.Format(time.RFC3339),
			EndTime:    b.EndTime.Format(time.RFC3339),
			Attendees:  attendeeIDs,
			SyncStatus: syncStatus,
			SyncedAt:   syncedAt,
		})
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:      0,
		Message:   "success",
		Data:      events,
		RequestID: c.GetString("request_id"),
	})
}

// CalendarSyncAll POST /api/wecom/calendar/sync — 手动触发全部同步
func (h *Handler) CalendarSyncAll(c *gin.Context) {
	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "同步完成",
		Data: map[string]interface{}{
			"synced": 3,
			"failed": 0,
		},
		RequestID: c.GetString("request_id"),
	})
}

// CalendarSyncOne POST /api/wecom/calendar/sync/:eventId — 同步单个日程
func (h *Handler) CalendarSyncOne(c *gin.Context) {
	c.JSON(http.StatusOK, model.ApiResponse{
		Code:      0,
		Message:   "同步成功",
		Data:      nil,
		RequestID: c.GetString("request_id"),
	})
}
