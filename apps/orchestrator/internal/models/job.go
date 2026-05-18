package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type JobStatus string

const (
	JobStatusPending      JobStatus = "PENDING"
	JobStatusProvisioning JobStatus = "PROVISIONING"
	JobStatusRunning      JobStatus = "RUNNING"
	JobStatusCleanup      JobStatus = "CLEANUP"
	JobStatusCompleted    JobStatus = "COMPLETED"
	JobStatusFailed       JobStatus = "FAILED"
	JobStatusTimedOut     JobStatus = "TIMED_OUT"
)

type PlanTier string

const (
	PlanStarter    PlanTier = "STARTER"
	PlanGrowth     PlanTier = "GROWTH"
	PlanEnterprise PlanTier = "ENTERPRISE"
)

type Job struct {
	ID             uuid.UUID       `json:"id" db:"id"`
	WorkspaceID    uuid.UUID       `json:"workspace_id" db:"workspace_id"`
	ActorID        uuid.UUID       `json:"actor_id" db:"actor_id"`
	ActorImage     string          `json:"actor_image" db:"actor_image"`
	Status         JobStatus       `json:"status" db:"status"`
	Input          json.RawMessage `json:"input" db:"input"`
	Output         json.RawMessage `json:"output,omitempty" db:"output"`
	CreditsUsed    int64           `json:"credits_used" db:"credits_used"`
	ProxyURL       string          `json:"proxy_url,omitempty" db:"proxy_url"`
	CookiePayload  string          `json:"cookie_payload,omitempty" db:"cookie_payload"`
	FingerprintID  string          `json:"fingerprint_id,omitempty" db:"fingerprint_id"`
	StartedAt      *time.Time      `json:"started_at,omitempty" db:"started_at"`
	FinishedAt     *time.Time      `json:"finished_at,omitempty" db:"finished_at"`
	TimeoutSecs    int             `json:"timeout_secs" db:"timeout_secs"`
	RetryCount     int             `json:"retry_count" db:"retry_count"`
	MaxRetries     int             `json:"max_retries" db:"max_retries"`
	WorkerPodName  string          `json:"worker_pod_name,omitempty" db:"worker_pod_name"`
	ErrorMessage   string          `json:"error_message,omitempty" db:"error_message"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type Actor struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	WorkspaceID uuid.UUID       `json:"workspace_id" db:"workspace_id"`
	Name        string          `json:"name" db:"name"`
	Image       string          `json:"image" db:"image"`
	Description string          `json:"description" db:"description"`
	Schema      json.RawMessage `json:"schema" db:"schema"`
	CreditCost  int64           `json:"credit_cost" db:"credit_cost"`
	IsPublic    bool            `json:"is_public" db:"is_public"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type User struct {
	ID          uuid.UUID `json:"id" db:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id" db:"workspace_id"`
	Email       string    `json:"email" db:"email"`
	Name        string    `json:"name" db:"name"`
	Role        string    `json:"role" db:"role"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type Workspace struct {
	ID             uuid.UUID `json:"id" db:"id"`
	Name           string    `json:"name" db:"name"`
	Plan           PlanTier  `json:"plan" db:"plan"`
	CreditBalance  int64     `json:"credit_balance" db:"credit_balance"`
	MaxConcurrency int       `json:"max_concurrency" db:"max_concurrency"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type Schedule struct {
	ID          uuid.UUID `json:"id" db:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id" db:"workspace_id"`
	ActorID     uuid.UUID `json:"actor_id" db:"actor_id"`
	Name        string    `json:"name" db:"name"`
	CronExpr    string    `json:"cron_expr" db:"cron_expr"`
	Timezone    string    `json:"timezone" db:"timezone"`
	Input       json.RawMessage `json:"input" db:"input"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	LastRun     *time.Time `json:"last_run,omitempty" db:"last_run"`
	NextRun     *time.Time `json:"next_run,omitempty" db:"next_run"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreditTransaction struct {
	ID          uuid.UUID `json:"id" db:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id" db:"workspace_id"`
	JobID       *uuid.UUID `json:"job_id,omitempty" db:"job_id"`
	Amount      int64     `json:"amount" db:"amount"`
	Kind        string    `json:"kind" db:"kind"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type JobFilter struct {
	Status      *JobStatus `json:"status,omitempty"`
	ActorID     *uuid.UUID `json:"actor_id,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

type CreateJobRequest struct {
	ActorID     uuid.UUID       `json:"actor_id"`
	Input       json.RawMessage `json:"input"`
	TimeoutSecs int             `json:"timeout_secs"`
	MaxRetries  int             `json:"max_retries"`
}
