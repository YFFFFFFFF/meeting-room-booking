package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/middleware"
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

// Login POST /api/auth/login
func (h *Handler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.UserID == "" {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:      400,
			Message:   "请提供有效的 user_id",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	var user model.User
	if err := h.db.Where("wecom_user_id = ?", req.UserID).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, model.ApiResponse{
			Code:      401,
			Message:   "用户不存在",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	claims := &middleware.Claims{
		UserID:   user.ID,
		Role:     string(user.Role),
		UserName: user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:      500,
			Message:   "Token生成失败",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data: model.AuthTokens{
			AccessToken:  tokenStr,
			RefreshToken: "refresh-" + user.ID + "-" + time.Now().Format("20060102150405"),
			ExpiresIn:    7200,
		},
		RequestID: c.GetString("request_id"),
	})
}

// Refresh POST /api/auth/refresh
func (h *Handler) Refresh(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")
	userName, _ := c.Get("user_name")

	claims := &middleware.Claims{
		UserID:   userID.(string),
		Role:     role.(string),
		UserName: userName.(string),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:      500,
			Message:   "Token刷新失败",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data: model.AuthTokens{
			AccessToken:  tokenStr,
			RefreshToken: "refresh-" + userID.(string) + "-" + time.Now().Format("20060102150405"),
			ExpiresIn:    7200,
		},
		RequestID: c.GetString("request_id"),
	})
}

// Me GET /api/auth/me
func (h *Handler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user model.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code:      404,
			Message:   "用户不存在",
			Data:      nil,
			RequestID: c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:      0,
		Message:   "success",
		Data:      user,
		RequestID: c.GetString("request_id"),
	})
}
