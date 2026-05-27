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
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/tudumm/storage-service/internal/config"
	"github.com/tudumm/storage-service/internal/handler"
	"github.com/tudumm/storage-service/internal/service"
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

	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		log.Fatal("connect to minio", zap.Error(err))
	}

	// Ensure bucket exists
	ctx := context.Background()
	exists, _ := minioClient.BucketExists(ctx, cfg.MinioBucket)
	if !exists {
		if err := minioClient.MakeBucket(ctx, cfg.MinioBucket, minio.MakeBucketOptions{}); err != nil {
			log.Warn("create minio bucket", zap.Error(err))
		}
	}

	storageSvc := service.NewStorageService(pool, minioClient, cfg.MinioBucket)

	datasetH := handler.NewDatasetHandler(storageSvc, log)
	kvH := handler.NewKVHandler(storageSvc, log)
	queueH := handler.NewQueueHandler(storageSvc, log)

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
		r.Get("/", datasetH.List)
		r.Post("/", datasetH.Create)
		r.Get("/{id}", datasetH.Get)
		r.Post("/{id}/items", datasetH.PushItems)
		r.Get("/{id}/items", datasetH.GetItems)
		r.Get("/{id}/export", datasetH.Export)
	})

	// Key-Value routes
	r.Route("/kv", func(r chi.Router) {
		r.Get("/", kvH.ListStores)
		r.Post("/", kvH.CreateStore)
		r.Get("/{storeId}/keys", kvH.ListKeys)
		r.Get("/{storeId}/records/{key}", kvH.GetValue)
		r.Put("/{storeId}/records/{key}", kvH.SetValue)
		r.Delete("/{storeId}/records/{key}", kvH.DeleteValue)
	})

	// Request Queue routes
	r.Route("/queues", func(r chi.Router) { //nolint:gocritic
		r.Post("/", queueH.Create)
		r.Get("/{id}", queueH.Get)
		r.Post("/{id}/requests", queueH.AddItems)
		r.Get("/{id}/head", queueH.FetchHead)
		r.Post("/{id}/requests/{itemId}/handled", queueH.MarkHandled)
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

	shutCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(shutCtx)
}
