package model

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRole string

const (
	RoleOwner  UserRole = "owner"
	RoleMember UserRole = "member"
	RoleViewer UserRole = "viewer"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	AvatarURL    string    `json:"avatar_url"`
	Provider     string    `json:"provider"` // local, github, google
	ProviderID   string    `json:"provider_id"`
	Verified     bool      `json:"verified"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	OwnerID   string    `json:"owner_id"`
	Plan      string    `json:"plan"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WorkspaceMember struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	Role        UserRole  `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
}

type APIKey struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	KeyHash     string    `json:"-"`
	KeyPrefix   string    `json:"key_prefix"`
	Scopes      []string  `json:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// UserQueries provides DB operations for users.
type UserQueries struct {
	pool *pgxpool.Pool
}

func NewUserQueries(pool *pgxpool.Pool) *UserQueries {
	return &UserQueries{pool: pool}
}

func (q *UserQueries) CreateUser(ctx context.Context, u *User) error {
	sql := `
		INSERT INTO users (id, email, password_hash, full_name, avatar_url, provider, provider_id, verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := q.pool.Exec(ctx, sql,
		u.ID, u.Email, u.PasswordHash, u.FullName, u.AvatarURL,
		u.Provider, u.ProviderID, u.Verified, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

func (q *UserQueries) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	sql := `SELECT id, email, password_hash, full_name, avatar_url, provider, provider_id, verified, created_at, updated_at
			FROM users WHERE email = $1`
	row := q.pool.QueryRow(ctx, sql, email)
	return scanUser(row)
}

func (q *UserQueries) GetUserByID(ctx context.Context, id string) (*User, error) {
	sql := `SELECT id, email, password_hash, full_name, avatar_url, provider, provider_id, verified, created_at, updated_at
			FROM users WHERE id = $1`
	row := q.pool.QueryRow(ctx, sql, id)
	return scanUser(row)
}

func (q *UserQueries) GetUserByProvider(ctx context.Context, provider, providerID string) (*User, error) {
	sql := `SELECT id, email, password_hash, full_name, avatar_url, provider, provider_id, verified, created_at, updated_at
			FROM users WHERE provider = $1 AND provider_id = $2`
	row := q.pool.QueryRow(ctx, sql, provider, providerID)
	return scanUser(row)
}

func scanUser(row pgx.Row) (*User, error) {
	u := &User{}
	err := row.Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.Verified, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (q *UserQueries) CreateWorkspace(ctx context.Context, w *Workspace) error {
	sql := `INSERT INTO workspaces (id, name, slug, owner_id, plan, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := q.pool.Exec(ctx, sql,
		w.ID, w.Name, w.Slug, w.OwnerID, w.Plan, w.CreatedAt, w.UpdatedAt,
	)
	return err
}

func (q *UserQueries) GetWorkspaceByOwner(ctx context.Context, ownerID string) (*Workspace, error) {
	sql := `SELECT id, name, slug, owner_id, plan, created_at, updated_at FROM workspaces WHERE owner_id = $1 LIMIT 1`
	row := q.pool.QueryRow(ctx, sql, ownerID)
	w := &Workspace{}
	err := row.Scan(&w.ID, &w.Name, &w.Slug, &w.OwnerID, &w.Plan, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return w, nil
}

func (q *UserQueries) CreateAPIKey(ctx context.Context, k *APIKey) error {
	sql := `INSERT INTO api_keys (id, workspace_id, user_id, name, key_hash, key_prefix, scopes, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := q.pool.Exec(ctx, sql,
		k.ID, k.WorkspaceID, k.UserID, k.Name, k.KeyHash, k.KeyPrefix, k.Scopes, k.ExpiresAt, k.CreatedAt,
	)
	return err
}

func (q *UserQueries) GetAPIKeyByHash(ctx context.Context, keyHash string) (*APIKey, error) {
	sql := `SELECT id, workspace_id, user_id, name, key_hash, key_prefix, scopes, last_used_at, expires_at, created_at
			FROM api_keys WHERE key_hash = $1`
	row := q.pool.QueryRow(ctx, sql, keyHash)
	k := &APIKey{}
	err := row.Scan(&k.ID, &k.WorkspaceID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix, &k.Scopes, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if err != nil {
		return nil, err
	}
	return k, nil
}

func (q *UserQueries) ListAPIKeys(ctx context.Context, workspaceID string) ([]*APIKey, error) {
	sql := `SELECT id, workspace_id, user_id, name, key_hash, key_prefix, scopes, last_used_at, expires_at, created_at
			FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := q.pool.Query(ctx, sql, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*APIKey
	for rows.Next() {
		k := &APIKey{}
		if err := rows.Scan(&k.ID, &k.WorkspaceID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix, &k.Scopes, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (q *UserQueries) DeleteAPIKey(ctx context.Context, id, workspaceID string) error {
	sql := `DELETE FROM api_keys WHERE id = $1 AND workspace_id = $2`
	_, err := q.pool.Exec(ctx, sql, id, workspaceID)
	return err
}

func (q *UserQueries) UpdateAPIKeyLastUsed(ctx context.Context, id string, t time.Time) error {
	sql := `UPDATE api_keys SET last_used_at = $1 WHERE id = $2`
	_, err := q.pool.Exec(ctx, sql, t, id)
	return err
}
