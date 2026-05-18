package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/customer"
	"github.com/stripe/stripe-go/v78/paymentintent"
	"github.com/stripe/stripe-go/v78/subscription"
	"github.com/tudumm/billing-service/internal/model"
	"go.uber.org/zap"
)

type StripeService struct {
	queries *model.BillingQueries
	log     *zap.Logger
}

func NewStripeService(apiKey string, queries *model.BillingQueries, log *zap.Logger) *StripeService {
	stripe.Key = apiKey
	return &StripeService{queries: queries, log: log}
}

// CreateSubscription creates or updates a Stripe subscription for a workspace.
func (s *StripeService) CreateSubscription(ctx context.Context, workspaceID, email, priceID string, plan model.PlanName) (*model.Subscription, error) {
	// Get or create Stripe customer
	existing, _ := s.queries.GetSubscription(ctx, workspaceID)
	var customerID string
	if existing != nil && existing.StripeCustomerID != "" {
		customerID = existing.StripeCustomerID
	} else {
		params := &stripe.CustomerParams{
			Email: stripe.String(email),
			Metadata: map[string]string{
				"workspace_id": workspaceID,
			},
		}
		c, err := customer.New(params)
		if err != nil {
			return nil, fmt.Errorf("create stripe customer: %w", err)
		}
		customerID = c.ID
	}

	// Create subscription
	subParams := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{Price: stripe.String(priceID)},
		},
		PaymentBehavior: stripe.String("default_incomplete"),
		Metadata: map[string]string{
			"workspace_id": workspaceID,
		},
	}
	subParams.AddExpand("latest_invoice.payment_intent")

	sub, err := subscription.New(subParams)
	if err != nil {
		return nil, fmt.Errorf("create stripe subscription: %w", err)
	}

	now := time.Now().UTC()
	s_ := &model.Subscription{
		ID:                   uuid.NewString(),
		WorkspaceID:          workspaceID,
		StripeSubscriptionID: sub.ID,
		StripeCustomerID:     customerID,
		PlanName:             plan,
		Status:               string(sub.Status),
		CurrentPeriodStart:   time.Unix(sub.CurrentPeriodStart, 0).UTC(),
		CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0).UTC(),
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := s.queries.UpsertSubscription(ctx, s_); err != nil {
		return nil, fmt.Errorf("save subscription: %w", err)
	}
	return s_, nil
}

// CancelSubscription cancels the subscription at period end.
func (s *StripeService) CancelSubscription(ctx context.Context, workspaceID string) (*model.Subscription, error) {
	sub, err := s.queries.GetSubscription(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
	}

	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(true),
	}
	updated, err := subscription.Update(sub.StripeSubscriptionID, params)
	if err != nil {
		return nil, fmt.Errorf("cancel stripe subscription: %w", err)
	}

	sub.CancelAtPeriodEnd = updated.CancelAtPeriodEnd
	sub.UpdatedAt = time.Now().UTC()
	if err := s.queries.UpsertSubscription(ctx, sub); err != nil {
		return nil, fmt.Errorf("save subscription: %w", err)
	}
	return sub, nil
}

// CreatePaymentIntent creates a Stripe payment intent for credit top-up.
func (s *StripeService) CreatePaymentIntent(ctx context.Context, workspaceID string, amountCents int64, currency string) (string, string, error) {
	sub, _ := s.queries.GetSubscription(ctx, workspaceID)
	var customerID *string
	if sub != nil && sub.StripeCustomerID != "" {
		customerID = &sub.StripeCustomerID
	}

	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(amountCents),
		Currency: stripe.String(currency),
		Metadata: map[string]string{
			"workspace_id": workspaceID,
			"type":         "credit_topup",
		},
	}
	if customerID != nil {
		params.Customer = customerID
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return "", "", fmt.Errorf("create payment intent: %w", err)
	}
	return pi.ID, pi.ClientSecret, nil
}
