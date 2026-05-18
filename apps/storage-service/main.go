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
	"github.com/tudumm/storage-service/internal/config"
	"go.uber.org/zap"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := config.Load()

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal("connect to postgres", zap.Error(err))
	}
	defer pool.Close()

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(60 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","service":"storage-service"}`)
	})

	// Dataset routes
	r.Route("/datasets", func(r chi.Router) {
		// r.Post("/", handler.CreateDataset)
		// r.Get("/{id}", handler.GetDataset)
		// r.Post("/{id}/items", handler.AppendItems)
		// r.Get("/{id}/items", handler.ListItems)
	})

	// Key-Value routes
	r.Route("/kv", func(r chi.Router) {
		// r.Put("/{key}", handler.PutValue)
		// r.Get("/{key}", handler.GetValue)
		// r.Delete("/{key}", handler.DeleteValue)
	})

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Info("storage-service starting", zap.String("addr", cfg.HTTPAddr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("listen and serve", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down storage-service")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
