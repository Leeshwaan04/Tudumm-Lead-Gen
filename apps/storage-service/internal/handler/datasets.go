package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/tudumm/storage-service/internal/model"
	"github.com/tudumm/storage-service/internal/service"
	"go.uber.org/zap"
)

type DatasetHandler struct {
	storage *service.StorageService
	log     *zap.Logger
}

func NewDatasetHandler(storage *service.StorageService, log *zap.Logger) *DatasetHandler {
	return &DatasetHandler{storage: storage, log: log}
}

func (h *DatasetHandler) Create(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	ds, err := h.storage.CreateDataset(r.Context(), workspaceID, req.Name)
	if err != nil {
		h.log.Error("create dataset", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "failed to create dataset")
		return
	}
	writeJSON(w, http.StatusCreated, ds)
}

func (h *DatasetHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ds, err := h.storage.GetDataset(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "dataset not found")
		return
	}
	writeJSON(w, http.StatusOK, ds)
}

func (h *DatasetHandler) List(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	datasets, err := h.storage.ListDatasets(r.Context(), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list datasets")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": datasets})
}

func (h *DatasetHandler) PushItems(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var items []map[string]any
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		writeError(w, http.StatusBadRequest, "invalid items — expected JSON array")
		return
	}
	count, err := h.storage.PushDatasetItems(r.Context(), id, items)
	if err != nil {
		h.log.Error("push dataset items", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "failed to push items")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"pushed": count})
}

func (h *DatasetHandler) GetItems(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 1000 {
		limit = 100
	}
	items, total, err := h.storage.GetDatasetItems(r.Context(), id, page, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch items")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data":  items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *DatasetHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	items, _, err := h.storage.GetDatasetItems(r.Context(), id, 1, 100000)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch items for export")
		return
	}

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", `attachment; filename="dataset.csv"`)
		exportCSV(w, items)
	case "ndjson":
		w.Header().Set("Content-Type", "application/x-ndjson")
		w.Header().Set("Content-Disposition", `attachment; filename="dataset.ndjson"`)
		enc := json.NewEncoder(w)
		for _, item := range items {
			enc.Encode(item)
		}
	default:
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="dataset.json"`)
		json.NewEncoder(w).Encode(items)
	}
}

func exportCSV(w http.ResponseWriter, items []model.DatasetItem) {
	if len(items) == 0 {
		return
	}
	writer := csv.NewWriter(w)
	defer writer.Flush()

	var headers []string
	for k := range items[0].Data {
		headers = append(headers, k)
	}
	writer.Write(headers)

	for _, item := range items {
		var row []string
		for _, h := range headers {
			v, _ := item.Data[h]
			row = append(row, strconv.Quote(fmt.Sprintf("%v", v)))
		}
		writer.Write(row)
	}
}
