package config

import (
	"os"
	"strconv"
)

type Config struct {
	HTTPAddr         string
	DatabaseURL      string
	RedisAddr        string
	RedisPassword    string
	JWTSecret        string
	JWTRefreshSecret string
	AccessTokenTTL   int // minutes
	RefreshTokenTTL  int // days
	GithubClientID   string
	GithubClientSecret string
	GoogleClientID   string
	GoogleClientSecret string
	OAuthCallbackBase string
}

func Load() *Config {
	return &Config{
		HTTPAddr:           getEnv("HTTP_ADDR", ":8001"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://tudumm:tudumm@localhost:5432/tudumm?sslmode=disable"),
		RedisAddr:          getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:      getEnv("REDIS_PASSWORD", ""),
		JWTSecret:          getEnv("JWT_SECRET", "super-secret-change-in-production"),
		JWTRefreshSecret:   getEnv("JWT_REFRESH_SECRET", "super-refresh-secret-change-in-production"),
		AccessTokenTTL:     getEnvInt("ACCESS_TOKEN_TTL_MIN", 15),
		RefreshTokenTTL:    getEnvInt("REFRESH_TOKEN_TTL_DAYS", 30),
		GithubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		OAuthCallbackBase:  getEnv("OAUTH_CALLBACK_BASE", "http://localhost:8001"),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
