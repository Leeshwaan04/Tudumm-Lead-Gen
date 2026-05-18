package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/tudumm/marketplace-service/internal/service"
)

func RegisterActorHandlers(r chi.Router, db *pgxpool.Pool, pubService *service.PublishingService, logger *zap.Logger) {
	r.Get("/actors", listActors(db, logger))
	r.Get("/actors/{id}", getActor(db, logger))
	r.Post("/actors", createActor(db, logger))
	r.Post("/actors/{id}/publish", publishVersion(pubService, logger))
}

func listActors(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Mock implementation for now
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "List actors endpoint"})
	}
}

func getActor(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": id, "status": "ok"})
	}
}

func createActor(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created"})
	}
}

func publishVersion(ps *service.PublishingService, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "publishing"})
	}
}
