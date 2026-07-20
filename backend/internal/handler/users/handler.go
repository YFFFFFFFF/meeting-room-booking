package users

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

// Search GET /api/users/search
func (h *Handler) Search(c *gin.Context) {
	q := c.Query("q")

	var users []model.User
	query := h.db.Model(&model.User{}).Where("status = ?", "active")

	if q != "" {
		query = query.Where("name ILIKE ? OR department ILIKE ? OR wecom_user_id ILIKE ?",
			"%"+q+"%", "%"+q+"%", "%"+q+"%")
	}

	query.Limit(20).Find(&users)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code: 0, Message: "success", Data: users, RequestID: c.GetString("request_id"),
	})
}
