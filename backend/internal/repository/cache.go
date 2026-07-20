package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
}

func NewCache(client *redis.Client) *Cache {
	return &Cache{client: client}
}

func (c *Cache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, data, ttl).Err()
}

func (c *Cache) Get(ctx context.Context, key string, dest interface{}) error {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (c *Cache) Del(ctx context.Context, keys ...string) error {
	return c.client.Del(ctx, keys...).Err()
}

// AcquireLock 获取分布式锁（用于预约冲突检测）
func (c *Cache) AcquireLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	ok, err := c.client.SetNX(ctx, key, "locked", ttl).Result()
	return ok, err
}

func (c *Cache) ReleaseLock(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}
