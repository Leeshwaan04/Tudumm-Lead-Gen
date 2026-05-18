package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/tudumm/orchestrator/internal/api"
	"github.com/tudumm/orchestrator/internal/domain"
	"github.com/tudumm/orchestrator/internal/executor"
	"github.com/tudumm/orchestrator/internal/scheduler"
	"github.com/tudumm/orchestrator/internal/store"
	"go.uber.org/zap"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := pgxpool.New(ctx, mustEnv("DATABASE_URL"))
	cancel()
	if err != nil {
		log.Fatal("connect postgres", zap.Error(err))
	}
	defer pool.Close()

	opt, err := redis.ParseURL(mustEnv("REDIS_URL"))
	if err != nil {
		log.Fatal("parse redis url", zap.Error(err))
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatal("connect redis", zap.Error(err))
	}

	pgStore := store.NewPostgresStore(pool)
	redisStore := store.NewRedisStore(rdb)
	sm := domain.NewStateMachine(1000)
	allocator := domain.NewResourceAllocator(pgStore, redisStore, log)

	// k8s client — falls back to in-cluster config
	k8sCfg, err := rest.InClusterConfig()
	if err != nil {
		log.Warn("k8s in-cluster config unavailable, provisioner disabled", zap.Error(err))
	}
	var k8sClient *kubernetes.Clientset
	if k8sCfg != nil {
		k8sClient, _ = kubernetes.NewForConfig(k8sCfg)
	}
	var k8sProv *executor.K8sProvisioner
	if k8sClient != nil {
		k8sProv = executor.NewK8sProvisioner(k8sClient, log)
	}

	// Watchdog
	watchdog := domain.NewWatchdog(pgStore, redisStore, sm, log)
	go watchdog.Run(context.Background())

	// Cron scheduler
	cronSched := scheduler.NewCronScheduler(pool, redisStore, log)
	if err := cronSched.LoadSchedules(context.Background()); err != nil {
		log.Warn("load schedules", zap.Error(err))
	}
	cronSched.Start()
	defer cronSched.Stop()

	// HTTP server
	handler := api.NewHandler(pgStore, redisStore, allocator, sm, k8sProv, log)
	httpSrv := &http.Server{
		Addr:         ":8080",
		Handler:      handler.Routes(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	// gRPC server
	grpcLis, err := net.Listen("tcp", ":9090")
	if err != nil {
		log.Fatal("listen grpc", zap.Error(err))
	}

	go func() {
		log.Info("HTTP server listening", zap.String("addr", ":8080"))
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("http server", zap.Error(err))
		}
	}()

	log.Info("gRPC server listening", zap.String("addr", ":9090"))
	_ = grpcLis // gRPC registration happens in internal/grpc package

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	httpSrv.Shutdown(shutCtx)
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s is not set", key))
	}
	return v
}
