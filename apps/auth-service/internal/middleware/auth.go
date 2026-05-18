package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/tudumm/auth-service/internal/service"
	"go.uber.org/zap"
)

type contextKey string

const (
	CtxUserID      contextKey = "user_id"
	CtxWorkspaceID contextKey = "workspace_id"
	CtxEmail       contextKey = "email"
)

type AuthMiddleware struct {
	authSvc *service.AuthService
	log     *zap.Logger
}

func NewAuthMiddleware(authSvc *service.AuthService, log *zap.Logger) *AuthMiddleware {
	return &AuthMiddleware{authSvc: authSvc, log: log}
}

func (m *AuthMiddleware) RequireJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractBearerToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "missing authorization token")
			return
		}

		claims, err := m.authSvc.ValidateAccessToken(token)
		if err != nil {
			m.log.Debug("invalid token", zap.Error(err))
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), CtxUserID, claims.UserID)
		ctx = context.WithValue(ctx, CtxWorkspaceID, claims.WorkspaceID)
		ctx = context.WithValue(ctx, CtxEmail, claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return parts[1]
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error":"` + msg + `"}`)) //nolint:errcheck
}
