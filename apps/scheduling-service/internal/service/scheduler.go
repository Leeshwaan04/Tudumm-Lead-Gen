package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"github.com/tudumm/scheduling-service/internal/model"
)

type Scheduler struct {
	db     *pgxpool.Pool
	rabbit *amqp.Channel
	cron   *cron.Cron
	logger *zap.Logger
}

func NewScheduler(db *pgxpool.Pool, rabbit *amqp.Channel, logger *zap.Logger) *Scheduler {
	return &Scheduler{
		db:     db,
		rabbit: rabbit,
		cron:   cron.New(cron.WithSeconds()),
		logger: logger,
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.logger.Info("Starting cron scheduler loop")
	s.LoadSchedules(ctx)
	s.cron.Start()
}

func (s *Scheduler) LoadSchedules(ctx context.Context) {
	// Query active schedules from DB
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
	_, err := s.cron.AddFunc(sched.CronExpr, func() {
		s.triggerRun(sched)
	})
	if err != nil {
		s.logger.Error("Failed to add schedule to cron", zap.String("id", sched.ID), zap.Error(err))
	}
}

func (s *Scheduler) triggerRun(sched model.Schedule) {
	s.logger.Info("Triggering scheduled run", zap.String("schedule_id", sched.ID), zap.String("actor_id", sched.ActorID))

	// Publish to execution queue
	body, _ := json.Marshal(map[string]interface{}{
		"workspace_id": sched.WorkspaceID,
		"actor_id":     sched.ActorID,
		"input":        sched.Input,
		"triggered_by": "SCHEDULE",
		"schedule_id":  sched.ID,
	})

	err := s.rabbit.Publish(
		"",               // exchange
		"execution_jobs", // routing key
		false,            // mandatory
		false,            // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		})

	if err != nil {
		s.logger.Error("Failed to publish execution job", zap.Error(err))
	}
}
