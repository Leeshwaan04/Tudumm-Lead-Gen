package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/tudumm/auth-service/internal/middleware"
	"github.com/tudumm/auth-service/internal/model"
	"github.com/tudumm/auth-service/internal/service"
	"go.uber.org/zap"
)

type AuthHandler struct {
	authSvc  *service.AuthService
	queries  *model.UserQueries
	validate *validator.Validate
	log      *zap.Logger
}

func NewAuthHandler(authSvc *service.AuthService, queries *model.UserQueries, log *zap.Logger) *AuthHandler {
	return &AuthHandler{
		authSvc:  authSvc,
		queries:  queries,
		validate: validator.New(),
		log:      log,
	}
}

func (h *AuthHandler) RegisterRoutes(r chi.Router, authMw *middleware.AuthMiddleware) {
	r.Post("/auth/register", h.Register)
	r.Post("/auth/login", h.Login)
	r.Post("/auth/refresh", h.Refresh)
	r.Post("/auth/logout", h.Logout)
	r.Group(func(r chi.Router) {
		r.Use(authMw.RequireJWT)
		r.Get("/auth/me", h.Me)
		r.Post("/auth/api-keys", h.CreateAPIKey)
		r.Delete("/auth/api-keys/{id}", h.DeleteAPIKey)
		r.Get("/auth/api-keys", h.ListAPIKeys)
	})
}

// Register handles POST /auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required,min=8"`
		FullName string `json:"full_name" validate:"required,min=2"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		respondError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	user, tokens, err := h.authSvc.RegisterUser(r.Context(), req.Email, req.Password, req.FullName)
	if err != nil {
		if err == service.ErrEmailTaken {
			respondError(w, http.StatusConflict, "email already registered")
			return
		}
		h.log.Error("register user", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "registration failed")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"user":   user,
		"tokens": tokens,
	})
}

// Login handles POST /auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		respondError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	user, tokens, err := h.authSvc.LoginUser(r.Context(), req.Email, req.Password)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			respondError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		h.log.Error("login user", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "login failed")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"user":   user,
		"tokens": tokens,
	})
}

// Refresh handles POST /auth/refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		respondError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	tokens, err := h.authSvc.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}
	respondJSON(w, http.StatusOK, tokens)
}

// Logout handles POST /auth/logout (client-side token disposal; server blacklist can be added)
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

// Me handles GET /auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	user, err := h.queries.GetUserByID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}
	respondJSON(w, http.StatusOK, user)
}

// CreateAPIKey handles POST /auth/api-keys
func (h *AuthHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	workspaceID, _ := r.Context().Value(middleware.CtxWorkspaceID).(string)

	var req struct {
		Name      string   `json:"name" validate:"required,min=1,max=64"`
		Scopes    []string `json:"scopes"`
		ExpiresAt *string  `json:"expires_at"` // RFC3339 or null
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		respondError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid expires_at format, use RFC3339")
			return
		}
		expiresAt = &t
	}

	key, rawKey, err := h.authSvc.CreateAPIKey(r.Context(), workspaceID, userID, req.Name, req.Scopes, expiresAt)
	if err != nil {
		h.log.Error("create api key", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to create API key")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"api_key":    key,
		"raw_key":    rawKey,
		"warning":    "Store this key securely — it will not be shown again.",
	})
}

// DeleteAPIKey handles DELETE /auth/api-keys/:id
func (h *AuthHandler) DeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	workspaceID, _ := r.Context().Value(middleware.CtxWorkspaceID).(string)
	keyID := chi.URLParam(r, "id")

	if err := h.queries.DeleteAPIKey(r.Context(), keyID, workspaceID); err != nil {
		h.log.Error("delete api key", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to delete API key")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "API key deleted"})
}

// ListAPIKeys handles GET /auth/api-keys
func (h *AuthHandler) ListAPIKeys(w http.ResponseWriter, r *http.Request) {
	workspaceID, _ := r.Context().Value(middleware.CtxWorkspaceID).(string)
	keys, err := h.queries.ListAPIKeys(r.Context(), workspaceID)
	if err != nil {
		h.log.Error("list api keys", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to list API keys")
		return
	}
	respondJSON(w, http.StatusOK, keys)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}
