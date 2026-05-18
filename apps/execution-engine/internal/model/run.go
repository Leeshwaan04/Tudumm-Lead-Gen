package model

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RunStatus string

const (
	StatusQueued  RunStatus = "QUEUED"
	StatusRunning RunStatus = "RUNNING"
	StatusSuccess RunStatus = "SUCCESS"
	StatusFailed  RunStatus = "FAILED"
	StatusCancelled RunStatus = "CANCELLED"
	StatusTimeout RunStatus = "TIMEOUT"
)

type Run struct {
	ID              string            `json:"id"`
	WorkspaceID     string            `json:"workspace_id"`
	ActorID         string            `json:"actor_id"`
	ActorVersionID  string            `json:"actor_version_id"`
	Status          RunStatus         `json:"status"`
	Input           map[string]interface{} `json:"input"`
	Output          map[string]interface{} `json:"output"`
	ExitCode        *int              `json:"exit_code"`
	ErrorMessage    string            `json:"error_message,omitempty"`
	ContainerID     string            `json:"container_id,omitempty"`
	ImageName       string            `json:"image_name"`
	MemoryMB        int               `json:"memory_mb"`
	CPUQuota        int64             `json:"cpu_quota"`
	StartedAt       *time.Time        `json:"started_at"`
	FinishedAt      *time.Time        `json:"finished_at"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type RunLog struct {
	ID        int64     `json:"id"`
	RunID     string    `json:"run_id"`
	Stream    string    `json:"stream"` // stdout or stderr
	Line      string    `json:"line"`
	CreatedAt time.Time `json:"created_at"`
}

type RunQueries struct {
	pool *pgxpool.Pool
}

func NewRunQueries(pool *pgxpool.Pool) *RunQueries {
	return &RunQueries{pool: pool}
}

func (q *RunQueries) CreateRun(ctx context.Context, r *Run) error {
	sql := `
		INSERT INTO runs (id, workspace_id, actor_id, actor_version_id, status, input, output,
		                  image_name, memory_mb, cpu_quota, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`
	_, err := q.pool.Exec(ctx, sql,
		r.ID, r.WorkspaceID, r.ActorID, r.ActorVersionID,
		string(r.Status), r.Input, r.Output,
		r.ImageName, r.MemoryMB, r.CPUQuota, r.CreatedAt, r.UpdatedAt,
	)
	return err
}

func (q *RunQueries) GetRun(ctx context.Context, id string) (*Run, error) {
	sql := `SELECT id, workspace_id, actor_id, actor_version_id, status, input, output,
	               exit_code, error_message, container_id, image_name, memory_mb, cpu_quota,
	               started_at, finished_at, created_at, updated_at
	        FROM runs WHERE id = $1`
	row := q.pool.QueryRow(ctx, sql, id)
	return scanRun(row)
}

func (q *RunQueries) ListRuns(ctx context.Context, workspaceID string, limit, offset int) ([]*Run, error) {
	sql := `SELECT id, workspace_id, actor_id, actor_version_id, status, input, output,
	               exit_code, error_message, container_id, image_name, memory_mb, cpu_quota,
	               started_at, finished_at, created_at, updated_at
	        FROM runs WHERE workspace_id = $1
	        ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := q.pool.Query(ctx, sql, workspaceID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var runs []*Run
	for rows.Next() {
		r, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

func (q *RunQueries) UpdateRunStatus(ctx context.Context, id string, status RunStatus, exitCode *int, errMsg string, containerID string) error {
	sql := `UPDATE runs SET status=$2, exit_code=$3, error_message=$4, container_id=$5, updated_at=NOW()
	        WHERE id=$1`
	_, err := q.pool.Exec(ctx, sql, id, string(status), exitCode, errMsg, containerID)
	return err
}

func (q *RunQueries) UpdateRunStarted(ctx context.Context, id, containerID string) error {
	sql := `UPDATE runs SET status='RUNNING', container_id=$2, started_at=NOW(), updated_at=NOW() WHERE id=$1`
	_, err := q.pool.Exec(ctx, sql, id, containerID)
	return err
}

func (q *RunQueries) UpdateRunFinished(ctx context.Context, id string, status RunStatus, exitCode int, errMsg string, output map[string]interface{}) error {
	sql := `UPDATE runs SET status=$2, exit_code=$3, error_message=$4, output=$5, finished_at=NOW(), updated_at=NOW() WHERE id=$1`
	_, err := q.pool.Exec(ctx, sql, id, string(status), exitCode, errMsg, output)
	return err
}

func (q *RunQueries) InsertLog(ctx context.Context, l *RunLog) error {
	sql := `INSERT INTO run_logs (run_id, stream, line, created_at) VALUES ($1,$2,$3,$4)`
	_, err := q.pool.Exec(ctx, sql, l.RunID, l.Stream, l.Line, l.CreatedAt)
	return err
}

func (q *RunQueries) GetLogs(ctx context.Context, runID string, since int64) ([]*RunLog, error) {
	sql := `SELECT id, run_id, stream, line, created_at FROM run_logs WHERE run_id=$1 AND id > $2 ORDER BY id ASC`
	rows, err := q.pool.Query(ctx, sql, runID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logs []*RunLog
	for rows.Next() {
		l := &RunLog{}
		if err := rows.Scan(&l.ID, &l.RunID, &l.Stream, &l.Line, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}

func scanRun(row pgx.Row) (*Run, error) {
	r := &Run{}
	err := row.Scan(
		&r.ID, &r.WorkspaceID, &r.ActorID, &r.ActorVersionID, &r.Status,
		&r.Input, &r.Output, &r.ExitCode, &r.ErrorMessage, &r.ContainerID,
		&r.ImageName, &r.MemoryMB, &r.CPUQuota,
		&r.StartedAt, &r.FinishedAt, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return r, nil
}
