package config

import "os"

type Config struct {
	Port         string
	DatabaseURL  string
	RabbitMQURL  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8006"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://tudumm:tudumm@localhost:5432/tudumm"),
		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://tudumm:tudumm@localhost:5672/"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
