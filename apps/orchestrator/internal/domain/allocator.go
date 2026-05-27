package domain

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/tudumm/orchestrator/internal/models"
	"github.com/tudumm/orchestrator/internal/store"
	"go.uber.org/zap"
)

type PlanLimits struct {
	MaxConcurrentJobs int
	MaxCredits        int64
}

var planLimits = map[models.PlanTier]PlanLimits{
	models.PlanStarter:    {MaxConcurrentJobs: 3, MaxCredits: 1000},
	models.PlanGrowth:     {MaxConcurrentJobs: 10, MaxCredits: 10000},
	models.PlanEnterprise: {MaxConcurrentJobs: 100, MaxCredits: 1000000},
}

type AllocateResult struct {
	Allowed bool
	Reason  string
}

type ResourceAllocator struct {
	pg  *store.PostgresStore
	rdb *store.RedisStore
	log *zap.Logger
}

func NewResourceAllocator(pg *store.PostgresStore, rdb *store.RedisStore, log *zap.Logger) *ResourceAllocator {
	return &ResourceAllocator{pg: pg, rdb: rdb, log: log}
}

func (a *ResourceAllocator) Allocate(ctx context.Context, workspaceID uuid.UUID, creditsNeeded int64) (AllocateResult, error) {
	ws, err := a.pg.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return AllocateResult{}, fmt.Errorf("get workspace: %w", err)
	}

	limits, ok := planLimits[ws.Plan]
	if !ok {
		limits = planLimits[models.PlanStarter]
	}

	// Check credits
	balance, err := a.pg.GetCreditBalance(ctx, workspaceID)
	if err != nil {
		return AllocateResult{}, fmt.Errorf("get credit balance: %w", err)
	}
	if balance < creditsNeeded {
		return AllocateResult{Allowed: false, Reason: fmt.Sprintf("insufficient credits: have %d, need %d", balance, creditsNeeded)}, nil
	}

	// Check concurrency
	activeCount, err := a.pg.GetActiveJobCount(ctx, workspaceID)
	if err != nil {
		return AllocateResult{}, fmt.Errorf("get active job count: %w", err)
	}
	if activeCount >= limits.MaxConcurrentJobs {
		return AllocateResult{Allowed: false, Reason: fmt.Sprintf("concurrency limit reached: %d/%d active jobs", activeCount, limits.MaxConcurrentJobs)}, nil
	}

	a.log.Info("allocation approved",
		zap.String("workspace_id", workspaceID.String()),
		zap.Int64("balance", balance),
		zap.Int("active_jobs", activeCount),
	)

	return AllocateResult{Allowed: true}, nil
}
