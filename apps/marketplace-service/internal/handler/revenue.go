package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"

	"github.com/tudumm/marketplace-service/internal/service"
)

func RegisterRevenueHandlers(r chi.Router, revService *service.RevenueService, logger *zap.Logger) {
	r.Get("/actors/{id}/revenue", getActorRevenue(revService, logger))
	r.Get("/revenue", getWorkspaceRevenue(revService, logger))
}

func getActorRevenue(svc *service.RevenueService, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID := chi.URLParam(r, "id")
		days, _ := strconv.Atoi(r.URL.Query().Get("days"))
		if days <= 0 {
			days = 30
		}
		summary, err := svc.GetActorRevenue(r.Context(), actorID, days)
		if err != nil {
			logger.Error("get actor revenue", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(summary)
	}
}

func getWorkspaceRevenue(svc *service.RevenueService, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workspaceID := r.Header.Get("X-Workspace-ID")
		days, _ := strconv.Atoi(r.URL.Query().Get("days"))
		if days <= 0 {
			days = 30
		}
		summaries, err := svc.GetWorkspaceRevenue(r.Context(), workspaceID, days)
		if err != nil {
			logger.Error("get workspace revenue", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"data": summaries})
	}
}
