package config

import "os"

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	MinioEndpoint   string
	MinioAccessKey  string
	MinioSecretKey  string
	MinioBucket     string
	MinioUseSSL     bool
}

func Load() *Config {
	return &Config{
		HTTPAddr:       getEnv("HTTP_ADDR", ":8004"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://tudumm:tudumm@localhost:5432/tudumm?sslmode=disable"),
		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:    getEnv("MINIO_BUCKET", "tudumm"),
		MinioUseSSL:    getEnv("MINIO_USE_SSL", "false") == "true",
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
