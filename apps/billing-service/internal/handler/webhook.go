package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/webhook"
	"github.com/tudumm/billing-service/internal/model"
	"github.com/tudumm/billing-service/internal/service"
	"go.uber.org/zap"
)

type WebhookHandler struct {
	credits       *service.CreditService
	queries       *model.BillingQueries
	webhookSecret string
	log           *zap.Logger
}

func NewWebhookHandler(credits *service.CreditService, queries *model.BillingQueries, webhookSecret string, log *zap.Logger) *WebhookHandler {
	return &WebhookHandler{credits: credits, queries: queries, webhookSecret: webhookSecret, log: log}
}

// POST /billing/webhook
func (h *WebhookHandler) Handle(w http.ResponseWriter, r *http.Request) {
	const maxBodySize = 65536
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	sig := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(body, sig, h.webhookSecret)
	if err != nil {
		h.log.Warn("webhook signature verification failed", zap.Error(err))
		respondError(w, http.StatusBadRequest, "invalid webhook signature")
		return
	}

	h.log.Info("stripe webhook received", zap.String("type", string(event.Type)), zap.String("id", event.ID))

	// Idempotency guard: if we've already processed this event, ack and return.
	// Prevents double-crediting on Stripe retries.
	firstTime, err := h.queries.MarkStripeEventProcessed(r.Context(), event.ID, string(event.Type))
	if err != nil {
		h.log.Error("idempotency check failed", zap.Error(err), zap.String("event_id", event.ID))
		respondError(w, http.StatusInternalServerError, "idempotency check failed")
		return
	}
	if !firstTime {
		h.log.Info("stripe event already processed, skipping", zap.String("event_id", event.ID))
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"received":true,"duplicate":true}`)) //nolint:errcheck
		return
	}

	switch event.Type {
	case "invoice.payment_succeeded":
		h.handleInvoicePaymentSucceeded(r, event)
	case "invoice.payment_failed":
		h.handleInvoicePaymentFailed(r, event)
	case "customer.subscription.updated":
		h.handleSubscriptionUpdated(r, event)
	case "customer.subscription.deleted":
		h.handleSubscriptionDeleted(r, event)
	case "payment_intent.succeeded":
		h.handlePaymentIntentSucceeded(r, event)
	default:
		h.log.Debug("unhandled stripe event", zap.String("type", string(event.Type)))
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"received":true}`)) //nolint:errcheck
}

func (h *WebhookHandler) handleInvoicePaymentSucceeded(r *http.Request, event stripe.Event) {
	var inv stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
		h.log.Error("unmarshal invoice", zap.Error(err))
		return
	}

	workspaceID, _ := inv.Metadata["workspace_id"]
	if workspaceID == "" {
		// Try to look up via subscription metadata
		return
	}

	periodStart := time.Unix(inv.PeriodStart, 0).UTC()
	periodEnd := time.Unix(inv.PeriodEnd, 0).UTC()
	paidAt := time.Now().UTC()

	dbInv := &model.Invoice{
		ID:              uuid.NewString(),
		WorkspaceID:     workspaceID,
		StripeInvoiceID: inv.ID,
		AmountCents:     inv.AmountPaid,
		Currency:        string(inv.Currency),
		Status:          "paid",
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		PaidAt:          &paidAt,
		InvoiceURL:      inv.HostedInvoiceURL,
		CreatedAt:       time.Now().UTC(),
	}
	if err := h.queries.InsertInvoice(r.Context(), dbInv); err != nil {
		h.log.Error("insert invoice", zap.Error(err))
	}
}

func (h *WebhookHandler) handleInvoicePaymentFailed(r *http.Request, event stripe.Event) {
	var inv stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
		h.log.Error("unmarshal invoice", zap.Error(err))
		return
	}
	h.log.Warn("invoice payment failed",
		zap.String("invoice_id", inv.ID),
		zap.Int64("amount", inv.AmountDue),
	)
}

func (h *WebhookHandler) handleSubscriptionUpdated(r *http.Request, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		h.log.Error("unmarshal subscription", zap.Error(err))
		return
	}

	workspaceID := sub.Metadata["workspace_id"]
	if workspaceID == "" {
		return
	}

	existing, err := h.queries.GetSubscription(r.Context(), workspaceID)
	if err != nil {
		return
	}
	existing.Status = string(sub.Status)
	existing.CancelAtPeriodEnd = sub.CancelAtPeriodEnd
	existing.CurrentPeriodStart = time.Unix(sub.CurrentPeriodStart, 0).UTC()
	existing.CurrentPeriodEnd = time.Unix(sub.CurrentPeriodEnd, 0).UTC()
	existing.UpdatedAt = time.Now().UTC()

	// Sync plan name from subscription metadata and update workspace resource limits
	planKey := sub.Metadata["plan"]
	if planKey != "" {
		existing.PlanName = model.PlanName(planKey)
		if err := h.queries.UpdateWorkspacePlan(r.Context(), workspaceID, planKey); err != nil {
			h.log.Error("sync workspace plan limits", zap.Error(err), zap.String("plan", planKey))
		} else {
			h.log.Info("synced workspace plan limits", zap.String("workspace_id", workspaceID), zap.String("plan", planKey))
		}
	}

	if err := h.queries.UpsertSubscription(r.Context(), existing); err != nil {
		h.log.Error("update subscription", zap.Error(err))
	}
}

func (h *WebhookHandler) handleSubscriptionDeleted(r *http.Request, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		h.log.Error("unmarshal subscription", zap.Error(err))
		return
	}

	workspaceID := sub.Metadata["workspace_id"]
	if workspaceID == "" {
		return
	}

	existing, _ := h.queries.GetSubscription(r.Context(), workspaceID)
	if existing == nil {
		return
	}
	existing.Status = "cancelled"
	existing.PlanName = model.PlanFree
	existing.UpdatedAt = time.Now().UTC()
	_ = h.queries.UpsertSubscription(r.Context(), existing)
	// Downgrade workspace to starter limits on cancellation
	_ = h.queries.UpdateWorkspacePlan(r.Context(), workspaceID, "starter")
}

func (h *WebhookHandler) handlePaymentIntentSucceeded(r *http.Request, event stripe.Event) {
	var pi stripe.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
		h.log.Error("unmarshal payment intent", zap.Error(err))
		return
	}

	workspaceID := pi.Metadata["workspace_id"]
	txType := pi.Metadata["type"]
	if workspaceID == "" || txType != "credit_topup" {
		return
	}

	// B-9: Only USD is supported for the 1 cent = 1 credit conversion. A non-USD
	// payment (e.g. INR/JPY) would otherwise massively over-credit because the
	// minor-unit-to-credit ratio differs by currency. Reject anything else.
	if pi.Currency != stripe.CurrencyUSD {
		h.log.Error("rejecting non-USD credit topup",
			zap.String("currency", string(pi.Currency)),
			zap.String("payment_intent", pi.ID),
			zap.String("workspace_id", workspaceID),
		)
		return
	}

	// Convert cents to credits (1 cent = 1 credit)
	credits := pi.AmountReceived

	// B-9: sanity bounds — reject absurd amounts that indicate a misconfigured
	// or malicious PaymentIntent. Max single top-up = $10,000 (1,000,000 credits).
	const maxCreditsPerTopup = int64(1_000_000)
	if credits <= 0 || credits > maxCreditsPerTopup {
		h.log.Error("rejecting out-of-bounds credit topup",
			zap.Int64("credits", credits),
			zap.String("payment_intent", pi.ID),
		)
		return
	}

	_, err := h.credits.AddCredits(r.Context(), workspaceID, credits, model.TxTopup,
		"Credit top-up via Stripe", pi.ID)
	if err != nil {
		h.log.Error("add credits on payment", zap.Error(err))
	}
}
