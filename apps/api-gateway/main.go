package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/tudumm/api-gateway/internal/middleware/auth"
	"github.com/tudumm/api-gateway/internal/middleware/logging"
	"github.com/tudumm/api-gateway/internal/middleware/ratelimit"
	"github.com/tudumm/api-gateway/internal/proxy"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	r := chi.NewRouter()

	// Basic Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(logging.NewZapMiddleware(logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// Redis for rate limiting
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	// Auth & Rate Limiting
	authClient := auth.NewClient(os.Getenv("AUTH_SERVICE_URL"))
	r.Use(auth.Middleware(authClient))
	r.Use(ratelimit.Middleware(rdb))

	// Proxy Routes
	proxy.RegisterRoutes(r, logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		logger.Info("Starting API Gateway", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Info("Shutting down API Gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
