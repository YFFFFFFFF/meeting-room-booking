package wecom

import (
	"net/http"

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
