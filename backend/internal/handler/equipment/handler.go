package equipment

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

// List GET /api/equipment
func (h *Handler) List(c *gin.Context) {
	roomID := c.Query("room_id")

	var equipments []model.Equipment
	query := h.db.Model(&model.Equipment{})
	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}
	query.Find(&equipments)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: equipments, RequestID: c.GetString("request_id"),
	})
}

// Update PUT /api/equipment/:id
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")

	var body model.Equipment
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	var equipment model.Equipment
	if err := h.db.First(&equipment, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "设备不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&equipment).Updates(map[string]interface{}{
		"status":     body.Status,
		"updated_at": time.Now(),
	})

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "更新成功", Data: nil, RequestID: c.GetString("request_id"),
	})
}

// CreateTicket POST /api/repair-tickets
func (h *Handler) CreateTicket(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var body model.RepairTicket
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	ticket := model.RepairTicket{
		ID:          generateID("rt"),
		EquipmentID: body.EquipmentID,
		ReporterID:  userID.(string),
		Description: body.Description,
		PhotoURL:    body.PhotoURL,
		Status:      "pending",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	h.db.Create(&ticket)

	c.JSON(http.StatusCreated, model.ApiResponse{
		Code: 0, Message: "报修提交成功", Data: ticket, RequestID: c.GetString("request_id"),
	})
}

// UpdateTicket PUT /api/repair-tickets/:id
func (h *Handler) UpdateTicket(c *gin.Context) {
	id := c.Param("id")

	var body model.RepairTicket
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code: 400, Message: "参数错误", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	var ticket model.RepairTicket
	if err := h.db.First(&ticket, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code: 404, Message: "工单不存在", Data: nil, RequestID: c.GetString("request_id"),
		})
		return
	}

	h.db.Model(&ticket).Updates(map[string]interface{}{
		"status":      body.Status,
		"assignee_id": body.AssigneeID,
		"updated_at":  time.Now(),
	})

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "更新成功", Data: ticket, RequestID: c.GetString("request_id"),
	})
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
