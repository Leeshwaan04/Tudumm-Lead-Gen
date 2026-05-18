package config

import "os"

type Config struct {
	HTTPAddr          string
	DatabaseURL       string
	StripeSecretKey   string
	StripeWebhookSecret string
	FreeCredits       int64 // credits granted on signup
}

func Load() *Config {
	return &Config{
		HTTPAddr:            getEnv("HTTP_ADDR", ":8003"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://tudumm:tudumm@localhost:5432/tudumm?sslmode=disable"),
		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		FreeCredits:         100,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
