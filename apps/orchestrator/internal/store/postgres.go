package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tudumm/orchestrator/internal/models"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) CreateJob(ctx context.Context, job *models.Job) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO runs (id, workspace_id, actor_id, actor_image, status, input, proxy_url,
		                  cookie_payload, fingerprint_id, timeout_secs, max_retries, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
		job.ID, job.WorkspaceID, job.ActorID, job.ActorImage, job.Status,
		job.Input, job.ProxyURL, job.CookiePayload, job.FingerprintID,
		job.TimeoutSecs, job.MaxRetries, time.Now().UTC(),
	)
	return err
}

func (s *PostgresStore) GetJob(ctx context.Context, jobID uuid.UUID) (*models.Job, error) {
	var job models.Job
	err := s.pool.QueryRow(ctx, `
		SELECT id, workspace_id, actor_id, actor_image, status, input, output,
		       credits_used, proxy_url, fingerprint_id, started_at, finished_at,
		       timeout_secs, retry_count, max_retries, worker_pod_name, created_at, updated_at
		FROM runs WHERE id = $1`, jobID,
	).Scan(
		&job.ID, &job.WorkspaceID, &job.ActorID, &job.ActorImage, &job.Status,
		&job.Input, &job.Output, &job.CreditsUsed, &job.ProxyURL, &job.FingerprintID,
		&job.StartedAt, &job.FinishedAt, &job.TimeoutSecs, &job.RetryCount,
		&job.MaxRetries, &job.WorkerPodName, &job.CreatedAt, &job.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("job %s not found", jobID)
	}
	return &job, err
}

func (s *PostgresStore) UpdateJobStatus(ctx context.Context, jobID uuid.UUID, status models.JobStatus, creditsUsed int64) error {
	now := time.Now().UTC()
	var finishedAt *time.Time
	if status == models.JobStatusCompleted || status == models.JobStatusFailed || status == models.JobStatusTimedOut {
		finishedAt = &now
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE runs SET status=$2, credits_used=credits_used+$3, finished_at=$4, updated_at=$5
		WHERE id=$1`, jobID, status, creditsUsed, finishedAt, now,
	)
	return err
}

func (s *PostgresStore) UpdateJobWorkerPod(ctx context.Context, jobID uuid.UUID, podName string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE runs SET worker_pod_name=$2, started_at=$3, updated_at=$3 WHERE id=$1`,
		jobID, podName, time.Now().UTC(),
	)
	return err
}

func (s *PostgresStore) GetStuckJobs(ctx context.Context, status models.JobStatus, olderThan time.Duration) ([]*models.Job, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	rows, err := s.pool.Query(ctx, `
		SELECT id, workspace_id, actor_id, status, timeout_secs, worker_pod_name, created_at
		FROM runs WHERE status=$1 AND updated_at < $2`, status, cutoff,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var j models.Job
		if err := rows.Scan(&j.ID, &j.WorkspaceID, &j.ActorID, &j.Status, &j.TimeoutSecs, &j.WorkerPodName, &j.CreatedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, &j)
	}
	return jobs, rows.Err()
}

func (s *PostgresStore) ListJobs(ctx context.Context, workspaceID uuid.UUID, limit, offset int) ([]*models.Job, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, workspace_id, actor_id, actor_image, status, credits_used,
		       started_at, finished_at, created_at
		FROM runs WHERE workspace_id=$1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		workspaceID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var j models.Job
		if err := rows.Scan(&j.ID, &j.WorkspaceID, &j.ActorID, &j.ActorImage, &j.Status,
			&j.CreditsUsed, &j.StartedAt, &j.FinishedAt, &j.CreatedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, &j)
	}
	return jobs, rows.Err()
}

func (s *PostgresStore) GetWorkspace(ctx context.Context, id uuid.UUID) (*models.Workspace, error) {
	var ws models.Workspace
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, plan, credits FROM workspaces WHERE id=$1`, id,
	).Scan(&ws.ID, &ws.Name, &ws.Plan, &ws.Credits)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("workspace %s not found", id)
	}
	return &ws, err
}

func (s *PostgresStore) GetCreditBalance(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	var balance int64
	err := s.pool.QueryRow(ctx, `SELECT credits FROM workspaces WHERE id=$1`, workspaceID).Scan(&balance)
	return balance, err
}

func (s *PostgresStore) DeductCredits(ctx context.Context, workspaceID uuid.UUID, amount int64) error {
	result, err := s.pool.Exec(ctx, `
		UPDATE workspaces SET credits = credits - $2 WHERE id=$1 AND credits >= $2`,
		workspaceID, amount,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("insufficient credits or workspace not found")
	}
	return nil
}

func (s *PostgresStore) GetActiveJobCount(ctx context.Context, workspaceID uuid.UUID) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM runs
		WHERE workspace_id=$1 AND status IN ('RUNNING','PROVISIONING')`,
		workspaceID,
	).Scan(&count)
	return count, err
}

func (s *PostgresStore) InsertRunLog(ctx context.Context, jobID uuid.UUID, level, message string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO run_logs (id, run_id, level, message, created_at)
		VALUES ($1,$2,$3,$4,$5)`,
		uuid.New(), jobID, level, message, time.Now().UTC(),
	)
	return err
}
