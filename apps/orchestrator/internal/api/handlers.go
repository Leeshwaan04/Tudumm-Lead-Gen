package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tudumm/orchestrator/internal/domain"
	"github.com/tudumm/orchestrator/internal/executor"
	"github.com/tudumm/orchestrator/internal/models"
	"github.com/tudumm/orchestrator/internal/store"
	"go.uber.org/zap"
)

type Handler struct {
	pg          *store.PostgresStore
	rdb         *store.RedisStore
	allocator   *domain.ResourceAllocator
	sm          *domain.StateMachine
	k8s         *executor.K8sProvisioner
	log         *zap.Logger
}

func NewHandler(pg *store.PostgresStore, rdb *store.RedisStore, allocator *domain.ResourceAllocator, sm *domain.StateMachine, k8s *executor.K8sProvisioner, log *zap.Logger) *Handler {
	return &Handler{pg: pg, rdb: rdb, allocator: allocator, sm: sm, k8s: k8s, log: log}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(AuthMiddleware)
	r.Get("/health", h.Health)
	r.Post("/jobs", h.CreateJob)
	r.Get("/jobs", h.ListJobs)
	r.Get("/jobs/{id}", h.GetJob)
	r.Post("/jobs/{id}/cancel", h.CancelJob)
	r.Get("/jobs/{id}/logs", h.StreamLogs)
	r.Post("/webhooks/worker", h.WorkerWebhook)
	return r
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type createJobRequest struct {
	ActorID    string          `json:"actor_id"`
	ActorImage string          `json:"actor_image"`
	Input      json.RawMessage `json:"input"`
	TimeoutSec int             `json:"timeout_sec"`
}

func (h *Handler) CreateJob(w http.ResponseWriter, r *http.Request) {
	wsID := workspaceIDFromCtx(r.Context())

	var req createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.allocator.Allocate(r.Context(), wsID, 10)
	if err != nil {
		h.log.Error("allocator error", zap.Error(err))
		http.Error(w, "allocation error", http.StatusInternalServerError)
		return
	}
	if !result.Allowed {
		http.Error(w, result.Reason, http.StatusPaymentRequired)
		return
	}

	actorID, _ := uuid.Parse(req.ActorID)
	timeout := req.TimeoutSec
	if timeout == 0 {
		timeout = 3600
	}

	job := &models.Job{
		ID:          uuid.New(),
		WorkspaceID: wsID,
		ActorID:     actorID,
		ActorImage:  req.ActorImage,
		Status:      models.JobStatusPending,
		Input:       req.Input,
		TimeoutSecs: timeout,
		MaxRetries:  2,
	}

	if err := h.pg.CreateJob(r.Context(), job); err != nil {
		h.log.Error("create job", zap.Error(err))
		http.Error(w, "failed to create job", http.StatusInternalServerError)
		return
	}

	payload, _ := executor.BuildPayload(job, "", "")
	encPayload, _ := executor.EncryptPayload(payload)

	podName, err := h.k8s.LaunchWorker(r.Context(), job.ID, req.ActorImage, encPayload)
	if err != nil {
		h.log.Error("launch worker", zap.Error(err))
		h.pg.UpdateJobStatus(r.Context(), job.ID, models.JobStatusFailed, 0)
		http.Error(w, "failed to launch worker", http.StatusInternalServerError)
		return
	}

	h.pg.UpdateJobWorkerPod(r.Context(), job.ID, podName)
	h.sm.Transition(job.ID, models.JobStatusPending, models.JobStatusProvisioning)
	h.rdb.SetJobStatus(r.Context(), job.ID, string(models.JobStatusProvisioning))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(job)
}

func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}
	job, err := h.pg.GetJob(r.Context(), jobID)
	if err != nil {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	wsID := workspaceIDFromCtx(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	jobs, err := h.pg.ListJobs(r.Context(), wsID, limit, offset)
	if err != nil {
		http.Error(w, "failed to list jobs", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": jobs, "limit": limit, "offset": offset})
}

func (h *Handler) CancelJob(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}
	if err := h.rdb.SetJobAbort(r.Context(), jobID); err != nil {
		http.Error(w, "failed to signal abort", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "abort_requested"})
}

func (h *Handler) StreamLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}
	// In production this would subscribe to a pub/sub channel per job.
	// Here we write a placeholder event and hold the connection.
	flusher.Flush()
	<-r.Context().Done()
}

type workerWebhookRequest struct {
	JobID       string `json:"job_id"`
	Status      string `json:"status"`
	ItemsCount  int    `json:"items_count"`
	CreditsUsed int64  `json:"credits_used"`
	Error       string `json:"error"`
}

func (h *Handler) WorkerWebhook(w http.ResponseWriter, r *http.Request) {
	var req workerWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	jobID, err := uuid.Parse(req.JobID)
	if err != nil {
		http.Error(w, "invalid job_id", http.StatusBadRequest)
		return
	}
	status := models.JobStatus(req.Status)
	if err := h.pg.UpdateJobStatus(r.Context(), jobID, status, req.CreditsUsed); err != nil {
		h.log.Error("update job status", zap.Error(err))
	}
	h.rdb.SetJobStatus(r.Context(), jobID, string(status))
	w.WriteHeader(http.StatusOK)
}
