package model

import "time"

type ActorStatus string

const (
	ActorStatusDraft     ActorStatus = "DRAFT"
	ActorStatusPublished ActorStatus = "PUBLISHED"
	ActorStatusDeprecated ActorStatus = "DEPRECATED"
)

type Actor struct {
	ID                 string      `json:"id"`
	WorkspaceID        string      `json:"workspace_id"`
	AuthorID           string      `json:"author_id"`
	Name               string      `json:"name"`
	Slug               string      `json:"slug"`
	Description        string      `json:"description"`
	Readme             string      `json:"readme"`
	Categories         []string    `json:"categories"`
	Tags               []string    `json:"tags"`
	IsPublic           bool        `json:"is_public"`
	Status             ActorStatus `json:"status"`
	IconURL            string      `json:"icon_url"`
	TotalRuns          int         `json:"total_runs"`
	TotalRevenueCents  int64       `json:"total_revenue_cents"`
	Rating             float64     `json:"rating"`
	RatingCount        int         `json:"rating_count"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

type ActorVersion struct {
	ID          string    `json:"id"`
	ActorID     string    `json:"actor_id"`
	Version     string    `json:"version"`
	DockerImage string    `json:"docker_image"`
	InputSchema interface{} `json:"input_schema"`
	ChangeLog   string    `json:"change_log"`
	IsLatest    bool      `json:"is_latest"`
	PublishedAt time.Time `json:"published_at"`
}
