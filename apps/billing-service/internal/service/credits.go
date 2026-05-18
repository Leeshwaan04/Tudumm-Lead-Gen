package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tudumm/billing-service/internal/model"
	"go.uber.org/zap"
)

var ErrInsufficientCredits = errors.New("insufficient credits")

type CreditService struct {
	queries *model.BillingQueries
	pool    *pgxpool.Pool
	log     *zap.Logger
}

func NewCreditService(queries *model.BillingQueries, pool *pgxpool.Pool, log *zap.Logger) *CreditService {
	return &CreditService{queries: queries, pool: pool, log: log}
}

// GetBalance returns the current credit balance for a workspace.
func (s *CreditService) GetBalance(ctx context.Context, workspaceID string) (*model.CreditBalance, error) {
	b, err := s.queries.GetBalance(ctx, workspaceID)
	if err != nil {
		// Return zero balance if not found
		return &model.CreditBalance{
			WorkspaceID: workspaceID,
			Balance:     0,
			UpdatedAt:   time.Now().UTC(),
		}, nil
	}
	return b, nil
}

// AddCredits atomically adds credits and records the transaction.
func (s *CreditService) AddCredits(ctx context.Context, workspaceID string, amount int64, txType model.CreditTransactionType, description, refID string) (*model.CreditBalance, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	balance, err := s.queries.UpsertBalance(ctx, workspaceID, amount)
	if err != nil {
		return nil, fmt.Errorf("update balance: %w", err)
	}

	tx := &model.CreditTransaction{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		Type:        txType,
		Amount:      amount,
		Balance:     balance.Balance,
		Description: description,
		RefID:       refID,
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.queries.InsertTransaction(ctx, tx); err != nil {
		s.log.Error("insert credit transaction", zap.Error(err))
	}
	return balance, nil
}

// DeductCredits atomically deducts credits, returning ErrInsufficientCredits if balance is too low.
func (s *CreditService) DeductCredits(ctx context.Context, workspaceID string, amount int64, description, refID string) (*model.CreditBalance, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	// Use a DB transaction to ensure atomicity
	pgTx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer pgTx.Rollback(ctx) //nolint:errcheck

	// Lock the balance row
	var currentBalance int64
	lockSQL := `SELECT balance FROM credit_balances WHERE workspace_id = $1 FOR UPDATE`
	err = pgTx.QueryRow(ctx, lockSQL, workspaceID).Scan(&currentBalance)
	if err != nil {
		// No balance row — treat as zero
		currentBalance = 0
	}

	if currentBalance < amount {
		return nil, ErrInsufficientCredits
	}

	newBalance := currentBalance - amount
	upsertSQL := `
		INSERT INTO credit_balances (workspace_id, balance, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (workspace_id) DO UPDATE SET balance = $2, updated_at = NOW()
		RETURNING workspace_id, balance, updated_at
	`
	balanceRow := pgTx.QueryRow(ctx, upsertSQL, workspaceID, newBalance)
	b := &model.CreditBalance{}
	if err := balanceRow.Scan(&b.WorkspaceID, &b.Balance, &b.UpdatedAt); err != nil {
		return nil, fmt.Errorf("update balance: %w", err)
	}

	txRecord := &model.CreditTransaction{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		Type:        model.TxDeduct,
		Amount:      -amount,
		Balance:     b.Balance,
		Description: description,
		RefID:       refID,
		CreatedAt:   time.Now().UTC(),
	}
	insertSQL := `INSERT INTO credit_transactions (id, workspace_id, type, amount, balance, description, ref_id, created_at)
	              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := pgTx.Exec(ctx, insertSQL,
		txRecord.ID, txRecord.WorkspaceID, string(txRecord.Type), txRecord.Amount,
		txRecord.Balance, txRecord.Description, txRecord.RefID, txRecord.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("insert transaction: %w", err)
	}

	if err := pgTx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return b, nil
}

// ListTransactions returns paginated transaction history for a workspace.
func (s *CreditService) ListTransactions(ctx context.Context, workspaceID string, limit, offset int) ([]*model.CreditTransaction, error) {
	return s.queries.ListTransactions(ctx, workspaceID, limit, offset)
}
