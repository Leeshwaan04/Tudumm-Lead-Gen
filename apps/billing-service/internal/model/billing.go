package model

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PlanName string

const (
	PlanFree       PlanName = "free"
	PlanStarter    PlanName = "starter"
	PlanPro        PlanName = "pro"
	PlanEnterprise PlanName = "enterprise"
)

type Plan struct {
	ID               string   `json:"id"`
	Name             PlanName `json:"name"`
	DisplayName      string   `json:"display_name"`
	PriceMonthly     int64    `json:"price_monthly_cents"`
	IncludedCredits  int64    `json:"included_credits"`
	MaxRunsPerMonth  int      `json:"max_runs_per_month"`
	MaxConcurrent    int      `json:"max_concurrent"`
	StripePriceID    string   `json:"stripe_price_id"`
}

type CreditTransactionType string

const (
	TxTopup    CreditTransactionType = "topup"
	TxDeduct   CreditTransactionType = "deduct"
	TxRefund   CreditTransactionType = "refund"
	TxBonus    CreditTransactionType = "bonus"
)

type CreditTransaction struct {
	ID          string                `json:"id"`
	WorkspaceID string                `json:"workspace_id"`
	Type        CreditTransactionType `json:"type"`
	Amount      int64                 `json:"amount"` // positive = add, negative = deduct
	Balance     int64                 `json:"balance"` // balance after transaction
	Description string                `json:"description"`
	RefID       string                `json:"ref_id"` // run_id or invoice_id
	CreatedAt   time.Time             `json:"created_at"`
}

type CreditBalance struct {
	WorkspaceID string    `json:"workspace_id"`
	Balance     int64     `json:"balance"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Invoice struct {
	ID             string    `json:"id"`
	WorkspaceID    string    `json:"workspace_id"`
	StripeInvoiceID string   `json:"stripe_invoice_id"`
	AmountCents    int64     `json:"amount_cents"`
	Currency       string    `json:"currency"`
	Status         string    `json:"status"`
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
	PaidAt         *time.Time `json:"paid_at"`
	InvoiceURL     string    `json:"invoice_url"`
	CreatedAt      time.Time `json:"created_at"`
}

type Subscription struct {
	ID                   string     `json:"id"`
	WorkspaceID          string     `json:"workspace_id"`
	StripeSubscriptionID string     `json:"stripe_subscription_id"`
	StripeCustomerID     string     `json:"stripe_customer_id"`
	PlanName             PlanName   `json:"plan_name"`
	Status               string     `json:"status"`
	CurrentPeriodStart   time.Time  `json:"current_period_start"`
	CurrentPeriodEnd     time.Time  `json:"current_period_end"`
	CancelAtPeriodEnd    bool       `json:"cancel_at_period_end"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type BillingQueries struct {
	pool *pgxpool.Pool
}

func NewBillingQueries(pool *pgxpool.Pool) *BillingQueries {
	return &BillingQueries{pool: pool}
}

func (q *BillingQueries) GetBalance(ctx context.Context, workspaceID string) (*CreditBalance, error) {
	sql := `SELECT workspace_id, balance, updated_at FROM credit_balances WHERE workspace_id = $1`
	row := q.pool.QueryRow(ctx, sql, workspaceID)
	b := &CreditBalance{}
	if err := row.Scan(&b.WorkspaceID, &b.Balance, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return b, nil
}

func (q *BillingQueries) UpsertBalance(ctx context.Context, workspaceID string, delta int64) (*CreditBalance, error) {
	sql := `
		INSERT INTO credit_balances (workspace_id, balance, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (workspace_id) DO UPDATE
		SET balance = credit_balances.balance + $2, updated_at = NOW()
		RETURNING workspace_id, balance, updated_at
	`
	row := q.pool.QueryRow(ctx, sql, workspaceID, delta)
	b := &CreditBalance{}
	if err := row.Scan(&b.WorkspaceID, &b.Balance, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return b, nil
}

func (q *BillingQueries) InsertTransaction(ctx context.Context, tx *CreditTransaction) error {
	sql := `INSERT INTO credit_transactions (id, workspace_id, type, amount, balance, description, ref_id, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	_, err := q.pool.Exec(ctx, sql,
		tx.ID, tx.WorkspaceID, string(tx.Type), tx.Amount, tx.Balance, tx.Description, tx.RefID, tx.CreatedAt,
	)
	return err
}

func (q *BillingQueries) ListTransactions(ctx context.Context, workspaceID string, limit, offset int) ([]*CreditTransaction, error) {
	sql := `SELECT id, workspace_id, type, amount, balance, description, ref_id, created_at
			FROM credit_transactions WHERE workspace_id = $1
			ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := q.pool.Query(ctx, sql, workspaceID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var txs []*CreditTransaction
	for rows.Next() {
		tx := &CreditTransaction{}
		if err := rows.Scan(&tx.ID, &tx.WorkspaceID, &tx.Type, &tx.Amount, &tx.Balance, &tx.Description, &tx.RefID, &tx.CreatedAt); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

func (q *BillingQueries) GetSubscription(ctx context.Context, workspaceID string) (*Subscription, error) {
	sql := `SELECT id, workspace_id, stripe_subscription_id, stripe_customer_id, plan_name, status,
	               current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
	        FROM subscriptions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`
	row := q.pool.QueryRow(ctx, sql, workspaceID)
	s := &Subscription{}
	err := row.Scan(&s.ID, &s.WorkspaceID, &s.StripeSubscriptionID, &s.StripeCustomerID,
		&s.PlanName, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd,
		&s.CancelAtPeriodEnd, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (q *BillingQueries) UpsertSubscription(ctx context.Context, s *Subscription) error {
	sql := `
		INSERT INTO subscriptions (id, workspace_id, stripe_subscription_id, stripe_customer_id, plan_name,
		                           status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (workspace_id) DO UPDATE
		SET stripe_subscription_id=$3, stripe_customer_id=$4, plan_name=$5, status=$6,
		    current_period_start=$7, current_period_end=$8, cancel_at_period_end=$9, updated_at=$11
	`
	_, err := q.pool.Exec(ctx, sql,
		s.ID, s.WorkspaceID, s.StripeSubscriptionID, s.StripeCustomerID, string(s.PlanName),
		s.Status, s.CurrentPeriodStart, s.CurrentPeriodEnd, s.CancelAtPeriodEnd, s.CreatedAt, s.UpdatedAt,
	)
	return err
}

func (q *BillingQueries) ListInvoices(ctx context.Context, workspaceID string, limit int) ([]*Invoice, error) {
	sql := `SELECT id, workspace_id, stripe_invoice_id, amount_cents, currency, status,
	               period_start, period_end, paid_at, invoice_url, created_at
	        FROM invoices WHERE workspace_id = $1
	        ORDER BY created_at DESC LIMIT $2`
	rows, err := q.pool.Query(ctx, sql, workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var invoices []*Invoice
	for rows.Next() {
		inv := &Invoice{}
		if err := rows.Scan(&inv.ID, &inv.WorkspaceID, &inv.StripeInvoiceID, &inv.AmountCents, &inv.Currency,
			&inv.Status, &inv.PeriodStart, &inv.PeriodEnd, &inv.PaidAt, &inv.InvoiceURL, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invoices = append(invoices, inv)
	}
	return invoices, rows.Err()
}

func (q *BillingQueries) InsertInvoice(ctx context.Context, inv *Invoice) error {
	sql := `INSERT INTO invoices (id, workspace_id, stripe_invoice_id, amount_cents, currency, status,
	                              period_start, period_end, paid_at, invoice_url, created_at)
	        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
	_, err := q.pool.Exec(ctx, sql,
		inv.ID, inv.WorkspaceID, inv.StripeInvoiceID, inv.AmountCents, inv.Currency, inv.Status,
		inv.PeriodStart, inv.PeriodEnd, inv.PaidAt, inv.InvoiceURL, inv.CreatedAt,
	)
	return err
}
