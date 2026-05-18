package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tudumm/execution-engine/internal/model"
	"github.com/tudumm/execution-engine/internal/service"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type RunsHandler struct {
	queries  *model.RunQueries
	executor *service.ExecutorService
	queue    *service.QueueService
	cfg      interface{ GetDefaultMemoryMB() int; GetDefaultCPUQuota() int64 }
	log      *zap.Logger
}

type RunsHandlerConfig struct {
	DefaultMemoryMB int
	DefaultCPUQuota int64
}

func (c *RunsHandlerConfig) GetDefaultMemoryMB() int    { return c.DefaultMemoryMB }
func (c *RunsHandlerConfig) GetDefaultCPUQuota() int64  { return c.DefaultCPUQuota }

func NewRunsHandler(queries *model.RunQueries, executor *service.ExecutorService, queue *service.QueueService, defMemMB int, defCPUQuota int64, log *zap.Logger) *RunsHandler {
	return &RunsHandler{
		queries:  queries,
		executor: executor,
		queue:    queue,
		cfg:      &RunsHandlerConfig{DefaultMemoryMB: defMemMB, DefaultCPUQuota: defCPUQuota},
		log:      log,
	}
}

// POST /runs
func (h *RunsHandler) CreateRun(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WorkspaceID    string                 `json:"workspace_id"`
		ActorID        string                 `json:"actor_id"`
		ActorVersionID string                 `json:"actor_version_id"`
		ImageName      string                 `json:"image_name"`
		Input          map[string]interface{} `json:"input"`
		MemoryMB       int                    `json:"memory_mb"`
		CPUQuota       int64                  `json:"cpu_quota"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ImageName == "" {
		respondError(w, http.StatusUnprocessableEntity, "image_name is required")
		return
	}
	if req.MemoryMB <= 0 {
		req.MemoryMB = h.cfg.GetDefaultMemoryMB()
	}
	if req.CPUQuota <= 0 {
		req.CPUQuota = h.cfg.GetDefaultCPUQuota()
	}

	// Pull workspace from header if set by gateway
	if wid := r.Header.Get("X-Workspace-ID"); wid != "" {
		req.WorkspaceID = wid
	}

	now := time.Now().UTC()
	run := &model.Run{
		ID:             uuid.NewString(),
		WorkspaceID:    req.WorkspaceID,
		ActorID:        req.ActorID,
		ActorVersionID: req.ActorVersionID,
		Status:         model.StatusQueued,
		Input:          req.Input,
		ImageName:      req.ImageName,
		MemoryMB:       req.MemoryMB,
		CPUQuota:       req.CPUQuota,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := h.queries.CreateRun(r.Context(), run); err != nil {
		h.log.Error("create run", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to create run")
		return
	}

	msg := &service.RunMessage{
		RunID:       run.ID,
		WorkspaceID: run.WorkspaceID,
		ImageName:   run.ImageName,
		Input:       run.Input,
		MemoryMB:    run.MemoryMB,
		CPUQuota:    run.CPUQuota,
	}
	if err := h.queue.Publish(r.Context(), msg); err != nil {
		h.log.Error("enqueue run", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to enqueue run")
		return
	}

	respondJSON(w, http.StatusCreated, run)
}

// GET /runs/:id
func (h *RunsHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	run, err := h.queries.GetRun(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "run not found")
		return
	}
	respondJSON(w, http.StatusOK, run)
}

// DELETE /runs/:id — cancel
func (h *RunsHandler) CancelRun(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	cancelled := h.executor.CancelRun(id)
	if !cancelled {
		respondError(w, http.StatusNotFound, "run not found or already finished")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "run cancelled"})
}

// GET /runs/:id/logs — WebSocket streaming
func (h *RunsHandler) StreamLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.log.Error("websocket upgrade", zap.Error(err))
		return
	}
	defer conn.Close()

	var lastID int64
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			logs, err := h.queries.GetLogs(r.Context(), id, lastID)
			if err != nil {
				h.log.Error("get logs", zap.Error(err))
				return
			}
			for _, l := range logs {
				if err := conn.WriteJSON(l); err != nil {
					return
				}
				lastID = l.ID
			}
			// Check if run finished
			run, _ := h.queries.GetRun(r.Context(), id)
			if run != nil && (run.Status == model.StatusSuccess || run.Status == model.StatusFailed || run.Status == model.StatusCancelled) {
				_ = conn.WriteJSON(map[string]string{"event": "run_finished", "status": string(run.Status)})
				return
			}
		}
	}
}

// GET /runs
func (h *RunsHandler) ListRuns(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	runs, err := h.queries.ListRuns(r.Context(), workspaceID, limit, offset)
	if err != nil {
		h.log.Error("list runs", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to list runs")
		return
	}
	respondJSON(w, http.StatusOK, runs)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}
