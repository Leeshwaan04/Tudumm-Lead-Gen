package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/tudumm/auth-service/internal/config"
	"github.com/tudumm/auth-service/internal/model"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailTaken      = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrTokenExpired    = errors.New("token expired")
	ErrTokenInvalid    = errors.New("token invalid")
	ErrAPIKeyExpired   = errors.New("api key expired")
)

type Claims struct {
	UserID      string `json:"user_id"`
	WorkspaceID string `json:"workspace_id"`
	Email       string `json:"email"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

type AuthService struct {
	queries *model.UserQueries
	cfg     *config.Config
	log     *zap.Logger
}

func NewAuthService(q *model.UserQueries, cfg *config.Config, log *zap.Logger) *AuthService {
	return &AuthService{queries: q, cfg: cfg, log: log}
}

func (s *AuthService) RegisterUser(ctx context.Context, email, password, fullName string) (*model.User, *TokenPair, error) {
	existing, err := s.queries.GetUserByEmail(ctx, email)
	if err == nil && existing != nil {
		return nil, nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("hashing password: %w", err)
	}

	now := time.Now().UTC()
	user := &model.User{
		ID:           uuid.NewString(),
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: string(hash),
		FullName:     fullName,
		Provider:     "local",
		Verified:     false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.queries.CreateUser(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("creating user: %w", err)
	}

	// Create default workspace
	ws := &model.Workspace{
		ID:        uuid.NewString(),
		Name:      fullName + "'s Workspace",
		Slug:      slugify(fullName) + "-" + uuid.NewString()[:8],
		OwnerID:   user.ID,
		Plan:      "free",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.queries.CreateWorkspace(ctx, ws); err != nil {
		s.log.Error("creating workspace", zap.Error(err))
	}

	tokens, err := s.issueTokens(user.ID, ws.ID, user.Email)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *AuthService) LoginUser(ctx context.Context, email, password string) (*model.User, *TokenPair, error) {
	user, err := s.queries.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	ws, err := s.queries.GetWorkspaceByOwner(ctx, user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("fetching workspace: %w", err)
	}

	tokens, err := s.issueTokens(user.ID, ws.ID, user.Email)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return []byte(s.cfg.JWTRefreshSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrTokenInvalid
	}

	return s.issueTokens(claims.UserID, claims.WorkspaceID, claims.Email)
}

func (s *AuthService) ValidateAccessToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrTokenInvalid
	}
	return claims, nil
}

func (s *AuthService) ValidateAPIKey(ctx context.Context, rawKey string) (*model.APIKey, error) {
	hash := hashAPIKey(rawKey)
	key, err := s.queries.GetAPIKeyByHash(ctx, hash)
	if err != nil {
		return nil, ErrTokenInvalid
	}
	if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
		return nil, ErrAPIKeyExpired
	}
	_ = s.queries.UpdateAPIKeyLastUsed(ctx, key.ID, time.Now().UTC())
	return key, nil
}

func (s *AuthService) CreateAPIKey(ctx context.Context, workspaceID, userID, name string, scopes []string, expiresAt *time.Time) (*model.APIKey, string, error) {
	raw, err := generateAPIKey()
	if err != nil {
		return nil, "", err
	}
	hash := hashAPIKey(raw)
	prefix := raw[:8]

	key := &model.APIKey{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Name:        name,
		KeyHash:     hash,
		KeyPrefix:   prefix,
		Scopes:      scopes,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.queries.CreateAPIKey(ctx, key); err != nil {
		return nil, "", fmt.Errorf("creating api key: %w", err)
	}
	return key, raw, nil
}

func (s *AuthService) issueTokens(userID, workspaceID, email string) (*TokenPair, error) {
	now := time.Now().UTC()
	accessExp := now.Add(time.Duration(s.cfg.AccessTokenTTL) * time.Minute)
	refreshExp := now.Add(time.Duration(s.cfg.RefreshTokenTTL) * 24 * time.Hour)

	accessClaims := &Claims{
		UserID:      userID,
		WorkspaceID: workspaceID,
		Email:       email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "tudumm-auth",
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	refreshClaims := &Claims{
		UserID:      userID,
		WorkspaceID: workspaceID,
		Email:       email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "tudumm-auth",
		},
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.cfg.JWTRefreshSecret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.cfg.AccessTokenTTL * 60,
	}, nil
}

func generateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "tdk_" + hex.EncodeToString(b), nil
}

func hashAPIKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	var out strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			out.WriteRune(r)
		}
	}
	return out.String()
}
