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
	"github.com/tudumm/billing-service/internal/config"
	"github.com/tudumm/billing-service/internal/handler"
	"github.com/tudumm/billing-service/internal/model"
	"github.com/tudumm/billing-service/internal/service"
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

	queries := model.NewBillingQueries(pool)
	creditSvc := service.NewCreditService(queries, pool, log)
	stripeSvc := service.NewStripeService(cfg.StripeSecretKey, queries, log)

	billingH := handler.NewBillingHandler(creditSvc, stripeSvc, queries, log)
	webhookH := handler.NewWebhookHandler(creditSvc, queries, cfg.StripeWebhookSecret, log)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","service":"billing-service"}`)
	})

	r.Get("/billing/plan", billingH.GetPlan)
	r.Post("/billing/subscribe", billingH.Subscribe)
	r.Get("/billing/usage", billingH.GetUsage)
	r.Get("/billing/invoices", billingH.ListInvoices)
	r.Post("/billing/credits/topup", billingH.TopupCredits)
	r.Post("/billing/webhook", webhookH.Handle)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("billing-service starting", zap.String("addr", cfg.HTTPAddr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("listen and serve", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down billing-service")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx) //nolint:errcheck
}
