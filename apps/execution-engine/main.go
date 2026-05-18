package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/docker/docker/client"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tudumm/execution-engine/internal/config"
	"github.com/tudumm/execution-engine/internal/handler"
	"github.com/tudumm/execution-engine/internal/model"
	"github.com/tudumm/execution-engine/internal/service"
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

	dockerClient, err := client.NewClientWithOpts(
		client.WithHost(cfg.DockerHost),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		log.Fatal("create docker client", zap.Error(err))
	}

	queueSvc, err := service.NewQueueService(cfg.RabbitMQURL, cfg.RunQueueName, cfg.DLQueueName, log)
	if err != nil {
		log.Fatal("create queue service", zap.Error(err))
	}
	defer queueSvc.Close()

	queries := model.NewRunQueries(pool)
	executorSvc := service.NewExecutorService(dockerClient, queries, cfg, log)
	runsH := handler.NewRunsHandler(queries, executorSvc, queueSvc, cfg.DefaultMemoryMB, cfg.DefaultCPUQuota, log)

	// Start consumer
	deliveries, err := queueSvc.Consume()
	if err != nil {
		log.Fatal("start consumer", zap.Error(err))
	}

	sem := make(chan struct{}, cfg.MaxConcurrent)
	go func() {
		for d := range deliveries {
			var msg service.RunMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				log.Error("unmarshal run message", zap.Error(err))
				d.Nack(false, false) //nolint:errcheck
				continue
			}

			sem <- struct{}{}
			d.Ack(false) //nolint:errcheck
			go func(m service.RunMessage) {
				defer func() { <-sem }()
				if err := executorSvc.Execute(context.Background(), &m); err != nil {
					log.Error("execute run", zap.String("run_id", m.RunID), zap.Error(err))
				}
			}(msg)
		}
	}()

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","service":"execution-engine"}`)
	})

	r.Post("/runs", runsH.CreateRun)
	r.Get("/runs", runsH.ListRuns)
	r.Get("/runs/{id}", runsH.GetRun)
	r.Delete("/runs/{id}", runsH.CancelRun)
	r.Get("/runs/{id}/logs", runsH.StreamLogs)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("execution-engine starting", zap.String("addr", cfg.HTTPAddr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("listen and serve", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down execution-engine")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx) //nolint:errcheck
}
