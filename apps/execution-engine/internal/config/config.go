package config

import (
	"os"
	"strconv"
)

type Config struct {
	HTTPAddr       string
	DatabaseURL    string
	RabbitMQURL    string
	DockerHost     string
	RunQueueName   string
	DLQueueName    string
	MaxConcurrent  int
	DefaultMemoryMB int
	DefaultCPUQuota int64 // microseconds per 100ms period
	BrowserServiceURL    string
	ProxyRouterURL       string
	EnrichmentServiceURL string
}

func Load() *Config {
	return &Config{
		HTTPAddr:             getEnv("HTTP_ADDR", ":8002"),
		DatabaseURL:          getEnv("DATABASE_URL", "postgres://tudumm:tudumm@localhost:5432/tudumm?sslmode=disable"),
		RabbitMQURL:          getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		DockerHost:           getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		RunQueueName:         getEnv("RUN_QUEUE_NAME", "tudumm.runs"),
		DLQueueName:          getEnv("DL_QUEUE_NAME", "tudumm.runs.dlq"),
		MaxConcurrent:        getEnvInt("MAX_CONCURRENT_RUNS", 10),
		DefaultMemoryMB:      getEnvInt("DEFAULT_MEMORY_MB", 512),
		DefaultCPUQuota:      int64(getEnvInt("DEFAULT_CPU_QUOTA_US", 50000)),
		BrowserServiceURL:    getEnv("BROWSER_SERVICE_URL", "http://browser-service:8007"),
		ProxyRouterURL:       getEnv("PROXY_ROUTER_URL", "http://proxy-router:8008"),
		EnrichmentServiceURL: getEnv("ENRICHMENT_SERVICE_URL", "http://enrichment-service:8009"),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}
