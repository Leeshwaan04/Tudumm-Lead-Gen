package model

import (
	"encoding/json"
	"time"
)

type TriggerType string
type ScheduleStatus string

const (
	TriggerTypeCron            TriggerType = "CRON"
	TriggerTypeWebhook         TriggerType = "WEBHOOK"
	TriggerTypeActorCompletion TriggerType = "ACTOR_COMPLETION"
	TriggerTypeManual          TriggerType = "MANUAL"

	ScheduleStatusActive  ScheduleStatus = "ACTIVE"
	ScheduleStatusPaused  ScheduleStatus = "PAUSED"
	ScheduleStatusDeleted ScheduleStatus = "DELETED"
)

type Schedule struct {
	ID             string          `json:"id"`
	WorkspaceID    string          `json:"workspace_id"`
	ActorID        string          `json:"actor_id"`
	WorkflowID     *string         `json:"workflow_id,omitempty"`
	Name           string          `json:"name"`
	CronExpr       string          `json:"cron_expr"`
	Timezone       string          `json:"timezone"`
	TriggerType    TriggerType     `json:"trigger_type"`
	Status         ScheduleStatus  `json:"status"`
	Input          json.RawMessage `json:"input"`
	NextRunAt      *time.Time      `json:"next_run_at,omitempty"`
	LastRunAt      *time.Time      `json:"last_run_at,omitempty"`
	LastRunStatus  *string         `json:"last_run_status,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}
