package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
	cronlib "github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"github.com/tudumm/scheduling-service/internal/model"
)

type Scheduler struct {
	db     *pgxpool.Pool
	rabbit *amqp.Channel
	cr     *cronlib.Cron
	logger *zap.Logger

	mu      sync.Mutex
	entries map[string]cronlib.EntryID // scheduleID -> cron entry ID
}

func NewScheduler(db *pgxpool.Pool, rabbit *amqp.Channel, logger *zap.Logger) *Scheduler {
	return &Scheduler{
		db:      db,
		rabbit:  rabbit,
		cr:      cronlib.New(cronlib.WithSeconds()),
		logger:  logger,
		entries: make(map[string]cronlib.EntryID),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.logger.Info("Starting cron scheduler loop")
	s.LoadSchedules(ctx)
	s.cr.Start()
}

func (s *Scheduler) LoadSchedules(ctx context.Context) {
	rows, err := s.db.Query(ctx, "SELECT id, workspace_id, actor_id, cron_expr, input FROM schedules WHERE status = 'ACTIVE'")
	if err != nil {
		s.logger.Error("Failed to fetch schedules", zap.Error(err))
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sched model.Schedule
		if err := rows.Scan(&sched.ID, &sched.WorkspaceID, &sched.ActorID, &sched.CronExpr, &sched.Input); err != nil {
			continue
		}
		s.AddSchedule(sched)
	}
}

func (s *Scheduler) AddSchedule(sched model.Schedule) {
	entryID, err := s.cr.AddFunc(sched.CronExpr, func() {
		s.triggerRun(sched)
	})
	if err != nil {
		s.logger.Error("Failed to add schedule to cron", zap.String("id", sched.ID), zap.Error(err))
		return
	}
	s.mu.Lock()
	s.entries[sched.ID] = entryID
	s.mu.Unlock()
}

func (s *Scheduler) RemoveSchedule(scheduleID string) {
	s.mu.Lock()
	entryID, ok := s.entries[scheduleID]
	if ok {
		s.cr.Remove(entryID)
		delete(s.entries, scheduleID)
	}
	s.mu.Unlock()
}

func (s *Scheduler) TriggerNow(ctx context.Context, sched model.Schedule) {
	s.triggerRun(sched)
	// Update last_run_at
	_, _ = s.db.Exec(ctx, `UPDATE schedules SET last_run_at=NOW() WHERE id=$1`, sched.ID)
}

func (s *Scheduler) triggerRun(sched model.Schedule) {
	s.logger.Info("Triggering scheduled run", zap.String("schedule_id", sched.ID), zap.String("actor_id", sched.ActorID))

	runID := newID()
	body, _ := json.Marshal(map[string]interface{}{
		"run_id":       runID,
		"workspace_id": sched.WorkspaceID,
		"actor_id":     sched.ActorID,
		"input":        sched.Input,
		"triggered_by": "SCHEDULE",
		"schedule_id":  sched.ID,
	})

	err := s.rabbit.Publish(
		"",               // exchange
		"execution_jobs", // routing key
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		})
	if err != nil {
		s.logger.Error("Failed to publish execution job", zap.Error(err))
		return
	}

	// Update last_run_at and next_run_at in DB
	ctx := context.Background()
	_, _ = s.db.Exec(ctx, `UPDATE schedules SET last_run_at=NOW() WHERE id=$1`, sched.ID)
}

func newID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return fmt.Sprintf("sched_%s", hex.EncodeToString(b))
}
