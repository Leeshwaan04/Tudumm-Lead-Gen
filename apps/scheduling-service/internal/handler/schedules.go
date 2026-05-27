package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/tudumm/scheduling-service/internal/model"
	"github.com/tudumm/scheduling-service/internal/service"
)

func RegisterScheduleHandlers(r chi.Router, s *service.Scheduler, db *pgxpool.Pool, logger *zap.Logger) {
	r.Get("/schedules", listSchedules(db, logger))
	r.Post("/schedules", createSchedule(s, db, logger))
	r.Get("/schedules/{id}", getSchedule(db, logger))
	r.Patch("/schedules/{id}", updateSchedule(s, db, logger))
	r.Delete("/schedules/{id}", deleteSchedule(s, db, logger))
	r.Post("/schedules/{id}/trigger", triggerSchedule(s, db, logger))
}

func listSchedules(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workspaceID := r.Header.Get("X-Workspace-ID")
		if workspaceID == "" {
			workspaceID = r.URL.Query().Get("workspace_id")
		}

		query := `SELECT id, workspace_id, actor_id, name, cron_expr, timezone, trigger_type,
		                 status, input, next_run_at, last_run_at, last_run_status, created_at
		          FROM schedules WHERE workspace_id = $1 AND status != 'DELETED'
		          ORDER BY created_at DESC LIMIT 100`

		rows, err := db.Query(r.Context(), query, workspaceID)
		if err != nil {
			logger.Error("list schedules", zap.Error(err))
			respondError(w, http.StatusInternalServerError, "failed to list schedules")
			return
		}
		defer rows.Close()

		schedules := []model.Schedule{}
		for rows.Next() {
			var s model.Schedule
			if err := rows.Scan(&s.ID, &s.WorkspaceID, &s.ActorID, &s.Name, &s.CronExpr,
				&s.Timezone, &s.TriggerType, &s.Status, &s.Input,
				&s.NextRunAt, &s.LastRunAt, &s.LastRunStatus, &s.CreatedAt); err != nil {
				logger.Error("scan schedule", zap.Error(err))
				continue
			}
			schedules = append(schedules, s)
		}
		respondJSON(w, http.StatusOK, schedules)
	}
}

func createSchedule(s *service.Scheduler, db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			WorkspaceID string          `json:"workspace_id"`
			ActorID     string          `json:"actor_id"`
			Name        string          `json:"name"`
			CronExpr    string          `json:"cron_expr"`
			Timezone    string          `json:"timezone"`
			Input       json.RawMessage `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Name == "" || req.CronExpr == "" || req.ActorID == "" {
			respondError(w, http.StatusUnprocessableEntity, "name, cron_expr, and actor_id are required")
			return
		}
		if req.WorkspaceID == "" {
			req.WorkspaceID = r.Header.Get("X-Workspace-ID")
		}
		if req.Timezone == "" {
			req.Timezone = "UTC"
		}
		if len(req.Input) == 0 {
			req.Input = json.RawMessage("{}")
		}

		now := time.Now().UTC()
		sched := model.Schedule{
			ID:          uuid.NewString(),
			WorkspaceID: req.WorkspaceID,
			ActorID:     req.ActorID,
			Name:        req.Name,
			CronExpr:    req.CronExpr,
			Timezone:    req.Timezone,
			TriggerType: model.TriggerTypeCron,
			Status:      model.ScheduleStatusActive,
			Input:       req.Input,
			CreatedAt:   now,
		}

		_, err := db.Exec(r.Context(), `
			INSERT INTO schedules (id, workspace_id, actor_id, name, cron_expr, timezone,
			                       trigger_type, status, input, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			sched.ID, sched.WorkspaceID, sched.ActorID, sched.Name, sched.CronExpr,
			sched.Timezone, string(sched.TriggerType), string(sched.Status),
			sched.Input, sched.CreatedAt)
		if err != nil {
			logger.Error("create schedule", zap.Error(err))
			respondError(w, http.StatusInternalServerError, "failed to create schedule")
			return
		}

		// Register with live cron scheduler
		s.AddSchedule(sched)

		respondJSON(w, http.StatusCreated, sched)
	}
}

func getSchedule(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		workspaceID := r.Header.Get("X-Workspace-ID")

		var sched model.Schedule
		err := db.QueryRow(r.Context(), `
			SELECT id, workspace_id, actor_id, name, cron_expr, timezone, trigger_type,
			       status, input, next_run_at, last_run_at, last_run_status, created_at
			FROM schedules WHERE id=$1 AND workspace_id=$2 AND status != 'DELETED'`,
			id, workspaceID).Scan(
			&sched.ID, &sched.WorkspaceID, &sched.ActorID, &sched.Name, &sched.CronExpr,
			&sched.Timezone, &sched.TriggerType, &sched.Status, &sched.Input,
			&sched.NextRunAt, &sched.LastRunAt, &sched.LastRunStatus, &sched.CreatedAt)
		if err != nil {
			respondError(w, http.StatusNotFound, "schedule not found")
			return
		}
		respondJSON(w, http.StatusOK, sched)
	}
}

func updateSchedule(s *service.Scheduler, db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		workspaceID := r.Header.Get("X-Workspace-ID")

		var req struct {
			Name     *string                `json:"name"`
			CronExpr *string                `json:"cron_expr"`
			Timezone *string                `json:"timezone"`
			Status   *model.ScheduleStatus  `json:"status"`
			Input    json.RawMessage        `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		// Load existing
		var sched model.Schedule
		err := db.QueryRow(r.Context(), `
			SELECT id, workspace_id, actor_id, name, cron_expr, timezone, trigger_type,
			       status, input, next_run_at, last_run_at, last_run_status, created_at
			FROM schedules WHERE id=$1 AND workspace_id=$2`, id, workspaceID).Scan(
			&sched.ID, &sched.WorkspaceID, &sched.ActorID, &sched.Name, &sched.CronExpr,
			&sched.Timezone, &sched.TriggerType, &sched.Status, &sched.Input,
			&sched.NextRunAt, &sched.LastRunAt, &sched.LastRunStatus, &sched.CreatedAt)
		if err != nil {
			respondError(w, http.StatusNotFound, "schedule not found")
			return
		}

		if req.Name != nil {
			sched.Name = *req.Name
		}
		if req.CronExpr != nil {
			sched.CronExpr = *req.CronExpr
		}
		if req.Timezone != nil {
			sched.Timezone = *req.Timezone
		}
		if req.Status != nil {
			sched.Status = *req.Status
		}
		if len(req.Input) > 0 {
			sched.Input = req.Input
		}

		_, err = db.Exec(r.Context(), `
			UPDATE schedules SET name=$2, cron_expr=$3, timezone=$4, status=$5, input=$6
			WHERE id=$1`,
			sched.ID, sched.Name, sched.CronExpr, sched.Timezone, string(sched.Status), sched.Input)
		if err != nil {
			logger.Error("update schedule", zap.Error(err))
			respondError(w, http.StatusInternalServerError, "failed to update schedule")
			return
		}

		// Re-register if active
		if sched.Status == model.ScheduleStatusActive {
			s.RemoveSchedule(sched.ID)
			s.AddSchedule(sched)
		} else {
			s.RemoveSchedule(sched.ID)
		}

		respondJSON(w, http.StatusOK, sched)
	}
}

func deleteSchedule(s *service.Scheduler, db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		workspaceID := r.Header.Get("X-Workspace-ID")

		result, err := db.Exec(r.Context(),
			`UPDATE schedules SET status='DELETED' WHERE id=$1 AND workspace_id=$2`, id, workspaceID)
		if err != nil || result.RowsAffected() == 0 {
			respondError(w, http.StatusNotFound, "schedule not found")
			return
		}

		s.RemoveSchedule(id)
		respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func triggerSchedule(s *service.Scheduler, db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		workspaceID := r.Header.Get("X-Workspace-ID")

		var sched model.Schedule
		err := db.QueryRow(r.Context(), `
			SELECT id, workspace_id, actor_id, name, cron_expr, timezone, trigger_type,
			       status, input, next_run_at, last_run_at, last_run_status, created_at
			FROM schedules WHERE id=$1 AND workspace_id=$2`, id, workspaceID).Scan(
			&sched.ID, &sched.WorkspaceID, &sched.ActorID, &sched.Name, &sched.CronExpr,
			&sched.Timezone, &sched.TriggerType, &sched.Status, &sched.Input,
			&sched.NextRunAt, &sched.LastRunAt, &sched.LastRunStatus, &sched.CreatedAt)
		if err != nil {
			respondError(w, http.StatusNotFound, "schedule not found")
			return
		}

		go s.TriggerNow(context.Background(), sched)
		respondJSON(w, http.StatusAccepted, map[string]string{"message": "run triggered"})
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}
