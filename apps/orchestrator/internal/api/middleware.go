package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const ctxWorkspaceID contextKey = "workspace_id"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || strings.HasPrefix(r.URL.Path, "/webhooks/") {
			next.ServeHTTP(w, r)
			return
		}
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "missing or invalid Authorization header", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := jwt.MapClaims{}
		_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte("JWT_SECRET_PLACEHOLDER"), nil
		})
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		wsIDStr, _ := claims["workspace_id"].(string)
		wsID, err := uuid.Parse(wsIDStr)
		if err != nil {
			http.Error(w, "invalid workspace_id in token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxWorkspaceID, wsID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func workspaceIDFromCtx(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(ctxWorkspaceID).(uuid.UUID)
	return id
}
