package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tudumm/auth-service/internal/config"
	"github.com/tudumm/auth-service/internal/model"
	"github.com/tudumm/auth-service/internal/service"
	"go.uber.org/zap"
)

type OAuthHandler struct {
	authSvc *service.AuthService
	queries *model.UserQueries
	cfg     *config.Config
	log     *zap.Logger
}

func NewOAuthHandler(authSvc *service.AuthService, queries *model.UserQueries, cfg *config.Config, log *zap.Logger) *OAuthHandler {
	return &OAuthHandler{authSvc: authSvc, queries: queries, cfg: cfg, log: log}
}

// GithubLogin handles GET /auth/oauth/github
func (h *OAuthHandler) GithubLogin(w http.ResponseWriter, r *http.Request) {
	state := uuid.NewString()
	// In production, store state in Redis with TTL for CSRF protection.
	params := url.Values{
		"client_id":    {h.cfg.GithubClientID},
		"redirect_uri": {h.cfg.OAuthCallbackBase + "/auth/oauth/github/callback"},
		"scope":        {"read:user user:email"},
		"state":        {state},
	}
	http.Redirect(w, r, "https://github.com/login/oauth/authorize?"+params.Encode(), http.StatusFound)
}

// GithubCallback handles GET /auth/oauth/github/callback
func (h *OAuthHandler) GithubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		respondError(w, http.StatusBadRequest, "missing oauth code")
		return
	}

	accessToken, err := h.exchangeGithubCode(r.Context(), code)
	if err != nil {
		h.log.Error("github token exchange", zap.Error(err))
		respondError(w, http.StatusBadGateway, "failed to exchange github code")
		return
	}

	ghUser, err := h.fetchGithubUser(r.Context(), accessToken)
	if err != nil {
		h.log.Error("fetch github user", zap.Error(err))
		respondError(w, http.StatusBadGateway, "failed to fetch github user")
		return
	}

	tokens, err := h.upsertOAuthUser(r.Context(), "github", fmt.Sprintf("%d", ghUser.ID), ghUser.Email, ghUser.Name, ghUser.AvatarURL)
	if err != nil {
		h.log.Error("upsert oauth user", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "oauth login failed")
		return
	}
	respondJSON(w, http.StatusOK, tokens)
}

// GoogleLogin handles GET /auth/oauth/google
func (h *OAuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	state := uuid.NewString()
	params := url.Values{
		"client_id":     {h.cfg.GoogleClientID},
		"redirect_uri":  {h.cfg.OAuthCallbackBase + "/auth/oauth/google/callback"},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
	}
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+params.Encode(), http.StatusFound)
}

// GoogleCallback handles GET /auth/oauth/google/callback
func (h *OAuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		respondError(w, http.StatusBadRequest, "missing oauth code")
		return
	}

	accessToken, err := h.exchangeGoogleCode(r.Context(), code)
	if err != nil {
		h.log.Error("google token exchange", zap.Error(err))
		respondError(w, http.StatusBadGateway, "failed to exchange google code")
		return
	}

	gUser, err := h.fetchGoogleUser(r.Context(), accessToken)
	if err != nil {
		h.log.Error("fetch google user", zap.Error(err))
		respondError(w, http.StatusBadGateway, "failed to fetch google user")
		return
	}

	tokens, err := h.upsertOAuthUser(r.Context(), "google", gUser.Sub, gUser.Email, gUser.Name, gUser.Picture)
	if err != nil {
		h.log.Error("upsert oauth user", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "oauth login failed")
		return
	}
	respondJSON(w, http.StatusOK, tokens)
}

func (h *OAuthHandler) upsertOAuthUser(ctx context.Context, provider, providerID, email, name, avatar string) (*service.TokenPair, error) {
	user, err := h.queries.GetUserByProvider(ctx, provider, providerID)
	if err != nil {
		// Create new user
		now := time.Now().UTC()
		user = &model.User{
			ID:         uuid.NewString(),
			Email:      strings.ToLower(email),
			FullName:   name,
			AvatarURL:  avatar,
			Provider:   provider,
			ProviderID: providerID,
			Verified:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if cerr := h.queries.CreateUser(ctx, user); cerr != nil {
			return nil, cerr
		}
		ws := &model.Workspace{
			ID:        uuid.NewString(),
			Name:      name + "'s Workspace",
			Slug:      uuid.NewString()[:8],
			OwnerID:   user.ID,
			Plan:      "free",
			CreatedAt: now,
			UpdatedAt: now,
		}
		_ = h.queries.CreateWorkspace(ctx, ws)
	}

	ws, err := h.queries.GetWorkspaceByOwner(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return h.authSvc.RefreshToken(ctx, "") // placeholder — issue tokens directly
	_ = ws
}

type githubUserResp struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

func (h *OAuthHandler) exchangeGithubCode(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"client_id":     {h.cfg.GithubClientID},
		"client_secret": {h.cfg.GithubClientSecret},
		"code":          {code},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var res struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	return res.AccessToken, nil
}

func (h *OAuthHandler) fetchGithubUser(ctx context.Context, token string) (*githubUserResp, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var u githubUserResp
	b, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(b, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

type googleUserResp struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (h *OAuthHandler) exchangeGoogleCode(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {h.cfg.GoogleClientID},
		"client_secret": {h.cfg.GoogleClientSecret},
		"redirect_uri":  {h.cfg.OAuthCallbackBase + "/auth/oauth/google/callback"},
		"grant_type":    {"authorization_code"},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var res struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	return res.AccessToken, nil
}

func (h *OAuthHandler) fetchGoogleUser(ctx context.Context, token string) (*googleUserResp, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var u googleUserResp
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, err
	}
	return &u, nil
}
