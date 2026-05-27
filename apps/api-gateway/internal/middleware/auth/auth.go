package auth

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Client struct {
	authServiceURL string
}

func NewClient(url string) *Client {
	return &Client{authServiceURL: url}
}

func Middleware(c *Client) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Bypass auth for login/signup/health
			if r.URL.Path == "/auth/login" || r.URL.Path == "/auth/register" || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// 1. Check API Key
			apiKey := r.Header.Get("X-API-Key")
			if apiKey != "" {
				// In a real app, you'd call auth-service to validate the key
				// For this scaffold, we'll assume it's valid and inject a mock workspace_id
				r.Header.Set("X-Workspace-Id", "ws_default_apikey")
				next.ServeHTTP(w, r)
				return
			}

			// 2. Check JWT
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			// In a real app, you'd verify the token with the secret or call auth-service
			// Here we just parse claims to show the pattern
			token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
			if err != nil {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if workspaceID, ok := claims["workspace_id"].(string); ok {
					r.Header.Set("X-Workspace-Id", workspaceID)
				}
				if userID, ok := claims["user_id"].(string); ok {
					r.Header.Set("X-User-Id", userID)
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
