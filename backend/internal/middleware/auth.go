package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

func InitJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

// GetJWTSecret 返回当前 JWT 签名密钥（供 auth handler 签发 token 使用）
func GetJWTSecret() []byte {
	return jwtSecret
}

type Claims struct {
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	UserName string `json:"name"`
	jwt.RegisteredClaims
}

// AuthRequired 验证 JWT Token
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":       401,
				"message":    "未登录",
				"data":       nil,
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":       401,
				"message":    "无效的Token格式",
				"data":       nil,
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":       401,
				"message":    "Token无效或已过期",
				"data":       nil,
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("user_name", claims.UserName)
		c.Next()
	}
}

// RoleRequired 角色权限控制
func RoleRequired(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"code":       403,
				"message":    "权限不足",
				"data":       nil,
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}

		roleStr := role.(string)
		for _, r := range roles {
			if r == roleStr {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"code":       403,
			"message":    "权限不足",
			"data":       nil,
			"request_id": c.GetString("request_id"),
		})
		c.Abort()
	}
}

// RequestID 注入请求ID
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateShortID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

func generateShortID() string {
	return "req-" + randomString(8)
}

func randomString(n int) string {
	b := make([]byte, n/2+1)
	rand.Read(b)
	return hex.EncodeToString(b)[:n]
}
