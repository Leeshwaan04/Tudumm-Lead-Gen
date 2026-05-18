package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/tudumm/billing-service/internal/model"
	"github.com/tudumm/billing-service/internal/service"
	"go.uber.org/zap"
)

type BillingHandler struct {
	credits *service.CreditService
	stripe  *service.StripeService
	queries *model.BillingQueries
	log     *zap.Logger
}

func NewBillingHandler(credits *service.CreditService, stripe *service.StripeService, queries *model.BillingQueries, log *zap.Logger) *BillingHandler {
	return &BillingHandler{credits: credits, stripe: stripe, queries: queries, log: log}
}

// GET /billing/plan
func (h *BillingHandler) GetPlan(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	sub, err := h.queries.GetSubscription(r.Context(), workspaceID)
	if err != nil {
		// Default to free plan
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"plan":   "free",
			"status": "active",
		})
		return
	}
	respondJSON(w, http.StatusOK, sub)
}

// POST /billing/subscribe
func (h *BillingHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	var req struct {
		Email   string          `json:"email"`
		PriceID string          `json:"price_id"`
		Plan    model.PlanName  `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.PriceID == "" {
		respondError(w, http.StatusUnprocessableEntity, "price_id is required")
		return
	}

	sub, err := h.stripe.CreateSubscription(r.Context(), workspaceID, req.Email, req.PriceID, req.Plan)
	if err != nil {
		h.log.Error("create subscription", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to create subscription")
		return
	}
	respondJSON(w, http.StatusCreated, sub)
}

// GET /billing/usage
func (h *BillingHandler) GetUsage(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			offset = v
		}
	}

	balance, err := h.credits.GetBalance(r.Context(), workspaceID)
	if err != nil {
		h.log.Error("get balance", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to get balance")
		return
	}

	txs, err := h.credits.ListTransactions(r.Context(), workspaceID, limit, offset)
	if err != nil {
		h.log.Error("list transactions", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to get usage")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"balance":      balance,
		"transactions": txs,
	})
}

// GET /billing/invoices
func (h *BillingHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	invoices, err := h.queries.ListInvoices(r.Context(), workspaceID, limit)
	if err != nil {
		h.log.Error("list invoices", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to list invoices")
		return
	}
	respondJSON(w, http.StatusOK, invoices)
}

// POST /billing/credits/topup
func (h *BillingHandler) TopupCredits(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-ID")
	var req struct {
		AmountCents int64  `json:"amount_cents"`
		Currency    string `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.AmountCents <= 0 {
		respondError(w, http.StatusUnprocessableEntity, "amount_cents must be positive")
		return
	}
	if req.Currency == "" {
		req.Currency = "usd"
	}

	piID, clientSecret, err := h.stripe.CreatePaymentIntent(r.Context(), workspaceID, req.AmountCents, req.Currency)
	if err != nil {
		h.log.Error("create payment intent", zap.Error(err))
		respondError(w, http.StatusInternalServerError, "failed to create payment intent")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"payment_intent_id": piID,
		"client_secret":     clientSecret,
	})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}
