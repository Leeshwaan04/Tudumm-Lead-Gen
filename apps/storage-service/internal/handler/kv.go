package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/tudumm/storage-service/internal/service"
	"go.uber.org/zap"
)

type KVHandler struct {
	storage *service.StorageService
	log     *zap.Logger
}

func NewKVHandler(storage *service.StorageService, log *zap.Logger) *KVHandler {
	return &KVHandler{storage: storage, log: log}
}

func (h *KVHandler) CreateStore(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	store, err := h.storage.CreateKVStore(r.Context(), workspaceID, req.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create store")
		return
	}
	writeJSON(w, http.StatusCreated, store)
}

func (h *KVHandler) ListStores(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	stores, err := h.storage.ListKVStores(r.Context(), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list stores")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": stores})
}

func (h *KVHandler) GetValue(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "storeId")
	key := chi.URLParam(r, "key")
	entry, err := h.storage.GetKVEntry(r.Context(), storeID, key)
	if err != nil {
		writeError(w, http.StatusNotFound, "key not found")
		return
	}
	w.Header().Set("Content-Type", entry.ContentType)
	w.Write(entry.Value)
}

func (h *KVHandler) SetValue(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "storeId")
	key := chi.URLParam(r, "key")
	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	body := make([]byte, 0, 1024)
	buf := make([]byte, 4096)
	for {
		n, err := r.Body.Read(buf)
		body = append(body, buf[:n]...)
		if err != nil {
			break
		}
	}

	if err := h.storage.SetKVEntry(r.Context(), storeID, key, contentType, body); err != nil {
		h.log.Error("set kv entry", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "failed to set value")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *KVHandler) DeleteValue(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "storeId")
	key := chi.URLParam(r, "key")
	if err := h.storage.DeleteKVEntry(r.Context(), storeID, key); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete key")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *KVHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "storeId")
	keys, err := h.storage.ListKVKeys(r.Context(), storeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list keys")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": keys})
}
