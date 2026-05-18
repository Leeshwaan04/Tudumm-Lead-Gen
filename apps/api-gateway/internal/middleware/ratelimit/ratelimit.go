package ratelimit

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

func Middleware(rdb *redis.Client) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				// If no API key, maybe it's a JWT-based session
				// For now, let's just bypass or use IP for rate limiting
				next.ServeHTTP(w, r)
				return
			}

			key := fmt.Sprintf("ratelimit:%s", apiKey)
			ctx := r.Context()

			// Simple sliding window or fixed window for demonstration
			// 100 requests per minute
			limit := 100
			window := time.Minute

			count, err := rdb.Incr(ctx, key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			if count == 1 {
				rdb.Expire(ctx, key, window)
			}

			if count > int64(limit) {
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte("Rate limit exceeded"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
