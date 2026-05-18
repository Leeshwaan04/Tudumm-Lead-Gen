package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

type RunMessage struct {
	RunID          string                 `json:"run_id"`
	WorkspaceID    string                 `json:"workspace_id"`
	ImageName      string                 `json:"image_name"`
	Input          map[string]interface{} `json:"input"`
	MemoryMB       int                    `json:"memory_mb"`
	CPUQuota       int64                  `json:"cpu_quota"`
}

type QueueService struct {
	conn      *amqp.Connection
	ch        *amqp.Channel
	queueName string
	dlqName   string
	log       *zap.Logger
}

func NewQueueService(amqpURL, queueName, dlqName string, log *zap.Logger) (*QueueService, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, fmt.Errorf("dial rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close() //nolint:errcheck
		return nil, fmt.Errorf("open channel: %w", err)
	}

	// Declare DLQ first
	_, err = ch.QueueDeclare(dlqName, true, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("declare dlq: %w", err)
	}

	// Declare main queue with DLQ routing
	args := amqp.Table{
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": dlqName,
		"x-message-ttl":             int32(24 * 60 * 60 * 1000), // 24h TTL
	}
	_, err = ch.QueueDeclare(queueName, true, false, false, false, args)
	if err != nil {
		return nil, fmt.Errorf("declare queue: %w", err)
	}

	if err := ch.Qos(1, 0, false); err != nil {
		return nil, fmt.Errorf("set qos: %w", err)
	}

	return &QueueService{
		conn:      conn,
		ch:        ch,
		queueName: queueName,
		dlqName:   dlqName,
		log:       log,
	}, nil
}

func (q *QueueService) Publish(ctx context.Context, msg *RunMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return q.ch.PublishWithContext(ctx, "", q.queueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         body,
	})
}

func (q *QueueService) Consume() (<-chan amqp.Delivery, error) {
	return q.ch.Consume(q.queueName, "execution-engine", false, false, false, false, nil)
}

func (q *QueueService) Close() {
	if q.ch != nil {
		q.ch.Close() //nolint:errcheck
	}
	if q.conn != nil {
		q.conn.Close() //nolint:errcheck
	}
}
