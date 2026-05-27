package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

func RegisterRatingHandlers(r chi.Router, db *pgxpool.Pool, logger *zap.Logger) {
	r.Post("/actors/{id}/ratings", submitRating(db, logger))
	r.Get("/actors/{id}/ratings", listRatings(db, logger))
}

func submitRating(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID := chi.URLParam(r, "id")
		workspaceID := r.Header.Get("X-Workspace-ID")

		var req struct {
			Score   int    `json:"score"`
			Comment string `json:"comment"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Score < 1 || req.Score > 5 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "score must be 1-5"})
			return
		}

		_, err := db.Exec(r.Context(), `
			INSERT INTO actor_ratings (actor_id, workspace_id, score, comment, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (actor_id, workspace_id) DO UPDATE
			SET score=$3, comment=$4, created_at=$5`,
			actorID, workspaceID, req.Score, req.Comment, time.Now().UTC())
		if err != nil {
			logger.Error("submit rating", zap.Error(err))
			// Update aggregate on actor
		}

		// Update aggregate rating on actor
		_, _ = db.Exec(r.Context(), `
			UPDATE actors SET
				rating = (SELECT AVG(score) FROM actor_ratings WHERE actor_id=$1),
				rating_count = (SELECT COUNT(*) FROM actor_ratings WHERE actor_id=$1),
				updated_at = NOW()
			WHERE id=$1`, actorID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"ok": "true"})
	}
}

func listRatings(db *pgxpool.Pool, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID := chi.URLParam(r, "id")
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if limit < 1 || limit > 100 {
			limit = 20
		}

		rows, err := db.Query(r.Context(), `
			SELECT workspace_id, score, comment, created_at
			FROM actor_ratings WHERE actor_id=$1
			ORDER BY created_at DESC LIMIT $2`,
			actorID, limit)
		if err != nil {
			logger.Error("list ratings", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Rating struct {
			WorkspaceID string    `json:"workspace_id"`
			Score       int       `json:"score"`
			Comment     string    `json:"comment"`
			CreatedAt   time.Time `json:"created_at"`
		}

		var ratings []Rating
		for rows.Next() {
			var rt Rating
			if err := rows.Scan(&rt.WorkspaceID, &rt.Score, &rt.Comment, &rt.CreatedAt); err != nil {
				continue
			}
			ratings = append(ratings, rt)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"data": ratings})
	}
}
