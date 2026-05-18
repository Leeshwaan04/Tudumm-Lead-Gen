package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/tudumm/storage-service/internal/service"
	"go.uber.org/zap"
)

type QueueHandler struct {
	storage *service.StorageService
	log     *zap.Logger
}

func NewQueueHandler(storage *service.StorageService, log *zap.Logger) *QueueHandler {
	return &QueueHandler{storage: storage, log: log}
}

func (h *QueueHandler) Create(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	q, err := h.storage.CreateQueue(r.Context(), workspaceID, req.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create queue")
		return
	}
	writeJSON(w, http.StatusCreated, q)
}

func (h *QueueHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	q, err := h.storage.GetQueue(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "queue not found")
		return
	}
	writeJSON(w, http.StatusOK, q)
}

func (h *QueueHandler) AddItems(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var items []struct {
		URL       string `json:"url"`
		UniqueKey string `json:"uniqueKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body — expected array of {url, uniqueKey}")
		return
	}
	added, deduped, err := h.storage.AddQueueItems(r.Context(), id, items)
	if err != nil {
		h.log.Error("add queue items", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "failed to add items")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"added": added, "deduplicated": deduped})
}

func (h *QueueHandler) FetchHead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.storage.FetchNextQueueItem(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "queue is empty")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *QueueHandler) MarkHandled(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	itemID := chi.URLParam(r, "itemId")
	var req struct {
		Status string `json:"status"` // HANDLED or FAILED
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Status = "HANDLED"
	}
	if req.Status != "HANDLED" && req.Status != "FAILED" {
		writeError(w, http.StatusBadRequest, "status must be HANDLED or FAILED")
		return
	}
	if err := h.storage.MarkQueueItem(r.Context(), id, itemID, req.Status); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update item status")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// shared response helpers used by all handlers in this package
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

var _ = fmt.Sprintf // suppress unused import in datasets.go
