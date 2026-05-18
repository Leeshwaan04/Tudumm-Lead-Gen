package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"github.com/tudumm/orchestrator/internal/store"
	"go.uber.org/zap"
)

type Schedule struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	ActorID     uuid.UUID
	ActorImage  string
	CronExpr    string
	Input       json.RawMessage
	Timezone    string
}

type CronScheduler struct {
	cron    *cron.Cron
	pg      *pgxpool.Pool
	rdb     *store.RedisStore
	log     *zap.Logger
	entries map[uuid.UUID]cron.EntryID
}

func NewCronScheduler(pg *pgxpool.Pool, rdb *store.RedisStore, log *zap.Logger) *CronScheduler {
	return &CronScheduler{
		cron:    cron.New(cron.WithSeconds(), cron.WithLocation(time.UTC)),
		pg:      pg,
		rdb:     rdb,
		log:     log,
		entries: make(map[uuid.UUID]cron.EntryID),
	}
}

func (s *CronScheduler) LoadSchedules(ctx context.Context) error {
	rows, err := s.pg.Query(ctx, `
		SELECT id, workspace_id, actor_id, actor_image, cron_expression, input, timezone
		FROM schedules WHERE status = 'ACTIVE'`)
	if err != nil {
		return fmt.Errorf("query schedules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sch Schedule
		var tz string
		if err := rows.Scan(&sch.ID, &sch.WorkspaceID, &sch.ActorID, &sch.ActorImage,
			&sch.CronExpr, &sch.Input, &tz); err != nil {
			s.log.Error("scan schedule row", zap.Error(err))
			continue
		}
		sch.Timezone = tz
		if err := s.Register(sch); err != nil {
			s.log.Error("register schedule", zap.String("id", sch.ID.String()), zap.Error(err))
		}
	}

	s.log.Info("loaded schedules", zap.Int("count", len(s.entries)))
	return rows.Err()
}

func (s *CronScheduler) Register(sch Schedule) error {
	loc := time.UTC
	if sch.Timezone != "" {
		var err error
		loc, err = time.LoadLocation(sch.Timezone)
		if err != nil {
			loc = time.UTC
		}
	}

	c := cron.New(cron.WithLocation(loc))
	entryID, err := c.AddFunc(sch.CronExpr, func() {
		if err := s.triggerJob(context.Background(), sch); err != nil {
			s.log.Error("trigger scheduled job", zap.String("schedule_id", sch.ID.String()), zap.Error(err))
		}
	})
	if err != nil {
		return fmt.Errorf("add cron func: %w", err)
	}
	s.entries[sch.ID] = entryID
	return nil
}

func (s *CronScheduler) triggerJob(ctx context.Context, sch Schedule) error {
	jobID := uuid.New()
	s.log.Info("triggering scheduled job",
		zap.String("schedule_id", sch.ID.String()),
		zap.String("job_id", jobID.String()),
	)

	_, err := s.pg.Exec(ctx, `
		INSERT INTO runs (id, workspace_id, actor_id, actor_image, status, input, created_at, updated_at)
		VALUES ($1,$2,$3,$4,'PENDING',$5,$6,$6)`,
		jobID, sch.WorkspaceID, sch.ActorID, sch.ActorImage, sch.Input, time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("insert job: %w", err)
	}

	return s.rdb.EnqueueJob(ctx, map[string]interface{}{
		"job_id":       jobID.String(),
		"workspace_id": sch.WorkspaceID.String(),
		"actor_image":  sch.ActorImage,
		"input":        string(sch.Input),
	})
}

func (s *CronScheduler) Start() {
	s.cron.Start()
	s.log.Info("cron scheduler started")
}

func (s *CronScheduler) Stop() {
	s.cron.Stop()
}
