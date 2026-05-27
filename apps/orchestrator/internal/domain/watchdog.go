package domain

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/tudumm/orchestrator/internal/models"
	"github.com/tudumm/orchestrator/internal/store"
)

const (
	watchdogInterval        = 30 * time.Second
	provisioningStuckWindow = 5 * time.Minute
)

type Watchdog struct {
	db     *store.PostgresStore
	sm     *StateMachine
	logger *zap.Logger
}

func NewWatchdog(db *store.PostgresStore, sm *StateMachine, logger *zap.Logger) *Watchdog {
	return &Watchdog{db: db, sm: sm, logger: logger}
}

func (w *Watchdog) Run(ctx context.Context) {
	ticker := time.NewTicker(watchdogInterval)
	defer ticker.Stop()

	w.logger.Info("watchdog started", zap.Duration("interval", watchdogInterval))

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("watchdog shutting down")
			return
		case <-ticker.C:
			w.checkRunningTimeout(ctx)
			w.checkProvisioningStuck(ctx)
		}
	}
}

func (w *Watchdog) checkRunningTimeout(ctx context.Context) {
	jobs, err := w.db.GetStuckJobs(ctx, models.JobStatusRunning, 0)
	if err != nil {
		w.logger.Error("watchdog: failed to query stuck running jobs", zap.Error(err))
		return
	}

	for _, job := range jobs {
		if job.StartedAt == nil {
			continue
		}
		deadline := job.StartedAt.Add(time.Duration(job.TimeoutSecs) * time.Second)
		if time.Now().UTC().Before(deadline) {
			continue
		}

		if err := w.sm.Transition(job.ID, models.JobStatusRunning, models.JobStatusTimedOut); err != nil {
			w.logger.Error("watchdog: invalid transition to TIMED_OUT",
				zap.String("job_id", job.ID.String()),
				zap.Error(err),
			)
			continue
		}

		if err := w.db.UpdateJobStatus(ctx, job.ID, models.JobStatusTimedOut, 0); err != nil {
			w.logger.Error("watchdog: failed to mark job TIMED_OUT",
				zap.String("job_id", job.ID.String()),
				zap.Error(err),
			)
			continue
		}

		w.logger.Warn("watchdog: job timed out",
			zap.String("job_id", job.ID.String()),
			zap.String("workspace_id", job.WorkspaceID.String()),
			zap.Int("timeout_secs", job.TimeoutSecs),
		)
	}
}

func (w *Watchdog) checkProvisioningStuck(ctx context.Context) {
	jobs, err := w.db.GetStuckJobs(ctx, models.JobStatusProvisioning, provisioningStuckWindow)
	if err != nil {
		w.logger.Error("watchdog: failed to query stuck provisioning jobs", zap.Error(err))
		return
	}

	for _, job := range jobs {
		if err := w.sm.Transition(job.ID, models.JobStatusProvisioning, models.JobStatusFailed); err != nil {
			w.logger.Error("watchdog: invalid transition to FAILED",
				zap.String("job_id", job.ID.String()),
				zap.Error(err),
			)
			continue
		}

		if err := w.db.UpdateJobStatus(ctx, job.ID, models.JobStatusFailed, 0); err != nil {
			w.logger.Error("watchdog: failed to mark provisioning job FAILED",
				zap.String("job_id", job.ID.String()),
				zap.Error(err),
			)
			continue
		}

		w.logger.Warn("watchdog: provisioning job stuck, marked FAILED",
			zap.String("job_id", job.ID.String()),
			zap.String("workspace_id", job.WorkspaceID.String()),
		)
	}
}
