package config

import (
	"os"
)

type Config struct {
	Port           string
	DatabaseURL    string
	RedisURL       string
	DockerRegistry string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8005"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://tudumm:tudumm@localhost:5432/tudumm"),
		RedisURL:       getEnv("REDIS_URL", "localhost:6379"),
		DockerRegistry: getEnv("DOCKER_REGISTRY", "localhost:5000"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
