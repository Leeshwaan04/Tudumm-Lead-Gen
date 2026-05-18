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
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tudumm/auth-service/internal/config"
	"github.com/tudumm/auth-service/internal/handler"
	"github.com/tudumm/auth-service/internal/middleware"
	"github.com/tudumm/auth-service/internal/model"
	"github.com/tudumm/auth-service/internal/service"
	"go.uber.org/zap"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync() //nolint:errcheck

	cfg := config.Load()

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal("connect to postgres", zap.Error(err))
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("ping postgres", zap.Error(err))
	}
	log.Info("connected to postgres")

	queries := model.NewUserQueries(pool)
	authSvc := service.NewAuthService(queries, cfg, log)
	authMw := middleware.NewAuthMiddleware(authSvc, log)

	authH := handler.NewAuthHandler(authSvc, queries, log)
	oauthH := handler.NewOAuthHandler(authSvc, queries, cfg, log)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","service":"auth-service"}`)
	})

	authH.RegisterRoutes(r, authMw)

	r.Get("/auth/oauth/github", oauthH.GithubLogin)
	r.Get("/auth/oauth/github/callback", oauthH.GithubCallback)
	r.Get("/auth/oauth/google", oauthH.GoogleLogin)
	r.Get("/auth/oauth/google/callback", oauthH.GoogleCallback)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("auth-service starting", zap.String("addr", cfg.HTTPAddr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("listen and serve", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down auth-service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("graceful shutdown failed", zap.Error(err))
	}
}
