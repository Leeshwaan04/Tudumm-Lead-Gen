package domain

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tudumm/orchestrator/internal/models"
)

type TransitionEvent struct {
	JobID     uuid.UUID
	From      models.JobStatus
	To        models.JobStatus
	Timestamp time.Time
}

type StateMachine struct {
	transitions map[models.JobStatus][]models.JobStatus
	events      chan TransitionEvent
	mu          sync.RWMutex
}

func NewStateMachine(eventBufferSize int) *StateMachine {
	sm := &StateMachine{
		events: make(chan TransitionEvent, eventBufferSize),
	}
	sm.transitions = map[models.JobStatus][]models.JobStatus{
		models.JobStatusPending:      {models.JobStatusProvisioning},
		models.JobStatusProvisioning: {models.JobStatusRunning, models.JobStatusFailed},
		models.JobStatusRunning:      {models.JobStatusCleanup, models.JobStatusFailed, models.JobStatusTimedOut},
		models.JobStatusCleanup:      {models.JobStatusCompleted, models.JobStatusFailed},
	}
	return sm
}

func (sm *StateMachine) Transition(jobID uuid.UUID, from, to models.JobStatus) error {
	sm.mu.RLock()
	allowed, ok := sm.transitions[from]
	sm.mu.RUnlock()

	if !ok {
		return fmt.Errorf("state %q is terminal or unknown; no transitions allowed", from)
	}

	for _, a := range allowed {
		if a == to {
			sm.events <- TransitionEvent{
				JobID:     jobID,
				From:      from,
				To:        to,
				Timestamp: time.Now().UTC(),
			}
			return nil
		}
	}

	return fmt.Errorf("transition from %q to %q is not allowed", from, to)
}

func (sm *StateMachine) IsTerminal(status models.JobStatus) bool {
	switch status {
	case models.JobStatusCompleted, models.JobStatusFailed, models.JobStatusTimedOut:
		return true
	}
	return false
}

func (sm *StateMachine) AllowedTransitions(from models.JobStatus) []models.JobStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	result := make([]models.JobStatus, len(sm.transitions[from]))
	copy(result, sm.transitions[from])
	return result
}

func (sm *StateMachine) Events() <-chan TransitionEvent {
	return sm.events
}
