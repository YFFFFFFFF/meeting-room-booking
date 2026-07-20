package config

import (
	"os"
)

type Config struct {
	ServerPort string
	DB         DBConfig
	Redis      RedisConfig
	JWT        JWTConfig
	WeCom      WeComConfig
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

func (d DBConfig) DSN() string {
	return "host=" + d.Host + " port=" + d.Port + " user=" + d.User + " password=" + d.Password + " dbname=" + d.DBName + " sslmode=disable"
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret     string
	ExpireHour int
}

type WeComConfig struct {
	CorpID     string
	CorpSecret string
	AgentID    string
	BaseURL    string
}

func Load() *Config {
	return &Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "meeting_room"),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "meeting-room-booking-secret-key"),
			ExpireHour: 2,
		},
		WeCom: WeComConfig{
			CorpID:     getEnv("WECOM_CORP_ID", ""),
			CorpSecret: getEnv("WECOM_CORP_SECRET", ""),
			AgentID:    getEnv("WECOM_AGENT_ID", ""),
			BaseURL:    getEnv("WECOM_BASE_URL", "https://qyapi.weixin.qq.com/cgi-bin"),
		},
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
