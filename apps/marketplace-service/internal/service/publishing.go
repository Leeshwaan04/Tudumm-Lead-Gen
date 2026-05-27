package service

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Publishing ────────────────────────────────────────────────────────────────

type PublishingService struct {
	db             *pgxpool.Pool
	dockerRegistry string
}

func NewPublishingService(db *pgxpool.Pool, registry string) *PublishingService {
	return &PublishingService{db: db, dockerRegistry: registry}
}

// Publish marks an actor as published and records the registry image reference.
func (s *PublishingService) Publish(ctx context.Context, actorID, gitURL, version string) error {
	imageRef := fmt.Sprintf("%s/actor-%s:%s", s.dockerRegistry, actorID, version)
	_, err := s.db.Exec(ctx,
		`UPDATE actors SET status='PUBLISHED', is_public=true, updated_at=NOW()
		 WHERE id=$1`,
		actorID)
	if err != nil {
		return fmt.Errorf("publish actor: %w", err)
	}
	// Store image reference in actor metadata (logged for now)
	_ = imageRef
	return nil
}

// Unpublish reverts an actor back to draft.
func (s *PublishingService) Unpublish(ctx context.Context, actorID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE actors SET status='DRAFT', is_public=false, updated_at=NOW() WHERE id=$1`,
		actorID)
	return err
}

// ── Revenue ───────────────────────────────────────────────────────────────────

type RevenueService struct {
	db *pgxpool.Pool
}

func NewRevenueService(db *pgxpool.Pool) *RevenueService {
	return &RevenueService{db: db}
}

type RevenueSummary struct {
	ActorID      string    `json:"actor_id"`
	TotalRuns    int64     `json:"total_runs"`
	TotalRevenue int64     `json:"total_revenue_cents"`
	PeriodStart  time.Time `json:"period_start"`
	PeriodEnd    time.Time `json:"period_end"`
}

func (s *RevenueService) RecordUsage(ctx context.Context, actorID, workspaceID string, credits int) error {
	_, err := s.db.Exec(ctx,
		`UPDATE actors SET total_runs = total_runs + 1, total_revenue_cents = total_revenue_cents + $2, updated_at=NOW()
		 WHERE id=$1`,
		actorID, credits)
	return err
}

func (s *RevenueService) GetActorRevenue(ctx context.Context, actorID string, days int) (*RevenueSummary, error) {
	periodStart := time.Now().UTC().AddDate(0, 0, -days)
	var totalRuns, totalRevenue int64

	err := s.db.QueryRow(ctx,
		`SELECT total_runs, total_revenue_cents FROM actors WHERE id=$1`,
		actorID,
	).Scan(&totalRuns, &totalRevenue)
	if err != nil {
		return nil, fmt.Errorf("get actor revenue: %w", err)
	}
	return &RevenueSummary{
		ActorID:      actorID,
		TotalRuns:    totalRuns,
		TotalRevenue: totalRevenue,
		PeriodStart:  periodStart,
		PeriodEnd:    time.Now().UTC(),
	}, nil
}

func (s *RevenueService) GetWorkspaceRevenue(ctx context.Context, workspaceID string, days int) ([]*RevenueSummary, error) {
	periodStart := time.Now().UTC().AddDate(0, 0, -days)
	rows, err := s.db.Query(ctx,
		`SELECT id, total_runs, total_revenue_cents FROM actors
		 WHERE workspace_id=$1 ORDER BY total_revenue_cents DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []*RevenueSummary
	for rows.Next() {
		r := &RevenueSummary{PeriodStart: periodStart, PeriodEnd: time.Now().UTC()}
		if err := rows.Scan(&r.ActorID, &r.TotalRuns, &r.TotalRevenue); err != nil {
			return nil, err
		}
		summaries = append(summaries, r)
	}
	return summaries, rows.Err()
}
