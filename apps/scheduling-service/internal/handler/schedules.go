package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"

	"github.com/tudumm/scheduling-service/internal/service"
)

func RegisterScheduleHandlers(r chi.Router, s *service.Scheduler, logger *zap.Logger) {
	r.Get("/schedules", listSchedules(logger))
	r.Post("/schedules", createSchedule(s, logger))
	r.Get("/schedules/{id}", getSchedule(logger))
	r.Delete("/schedules/{id}", deleteSchedule(logger))
}

func listSchedules(logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "List schedules"})
	}
}

func createSchedule(s *service.Scheduler, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created"})
	}
}

func getSchedule(logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": id})
	}
}

func deleteSchedule(logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}
}
