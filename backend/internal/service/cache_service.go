package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
)

// CacheService Redis 缓存服务
type CacheService struct {
	db    *repository.DB
	cache *repository.Cache
}

func NewCacheService(db *repository.DB, cache *repository.Cache) *CacheService {
	return &CacheService{db: db, cache: cache}
}

// GetRoomsWithCache 获取会议室列表（带缓存）
func (s *CacheService) GetRoomsWithCache(ctx context.Context) ([]model.MeetingRoom, error) {
	cacheKey := "rooms:active:list"
	var rooms []model.MeetingRoom

	if err := s.cache.Get(ctx, cacheKey, &rooms); err == nil && len(rooms) > 0 {
		log.Printf("[Cache] 命中缓存: %s (%d rooms)", cacheKey, len(rooms))
		return rooms, nil
	}

	// 缓存未命中，查数据库
	s.db.Where("status = ?", "active").Find(&rooms)
	if len(rooms) > 0 {
		// 缓存 5 分钟
		s.cache.Set(ctx, cacheKey, rooms, 5*time.Minute)
		log.Printf("[Cache] 写入缓存: %s (%d rooms, TTL=5m)", cacheKey, len(rooms))
	}

	return rooms, nil
}

// GetBookingRulesWithCache 获取预约规则（带缓存）
func (s *CacheService) GetBookingRulesWithCache(ctx context.Context) (*model.BookingRules, error) {
	cacheKey := "config:booking-rules"
	var rules model.BookingRules

	if err := s.cache.Get(ctx, cacheKey, &rules); err == nil {
		return &rules, nil
	}

	if err := s.db.First(&rules).Error; err != nil {
		// 返回默认规则
		rules = model.BookingRules{
			MaxAdvanceDays: 30, LatestBookingMinutes: 15,
			MinDurationMinutes: 15, MaxDurationMinutes: 240,
			MaxDailyBookings: 5, SmallRoomMinAttendees: 1,
			MediumRoomMinAttendees: 3, LargeRoomMinAttendees: 10,
			LargeRoomThreshold: 20, ApprovalTimeoutHours: 24,
		}
	}

	// 缓存 10 分钟
	s.cache.Set(ctx, cacheKey, rules, 10*time.Minute)
	return &rules, nil
}

// InvalidateRoomCache 清除会议室相关缓存
func (s *CacheService) InvalidateRoomCache(ctx context.Context) {
	s.cache.Del(ctx, "rooms:active:list")
	log.Println("[Cache] 会议室缓存已清除")
}

// InvalidateRulesCache 清除规则缓存
func (s *CacheService) InvalidateRulesCache(ctx context.Context) {
	s.cache.Del(ctx, "config:booking-rules")
	log.Println("[Cache] 预约规则缓存已清除")
}

// CacheStats 缓存统计
func (s *CacheService) CacheStats(ctx context.Context) map[string]interface{} {
	// 检查缓存状态
	stats := map[string]interface{}{
		"cache_service": "redis",
		"status":        "active",
	}

	// 检查各缓存键
	for _, key := range []string{"rooms:active:list", "config:booking-rules"} {
		var val interface{}
		if err := s.cache.Get(ctx, key, &val); err == nil {
			stats[key] = "hit"
		} else {
			stats[key] = "miss"
		}
	}

	return stats
}

// WarmUpCache 预热缓存
func (s *CacheService) WarmUpCache(ctx context.Context) {
	log.Println("[Cache] 开始预热...")

	// 预热会议室列表
	s.GetRoomsWithCache(ctx)

	// 预热预约规则
	s.GetBookingRulesWithCache(ctx)

	log.Println("[Cache] 预热完成")
}

// 序列化辅助
func marshal(v interface{}) (string, error) {
	data, err := json.Marshal(v)
	return string(data), err
}

func unmarshal(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}
