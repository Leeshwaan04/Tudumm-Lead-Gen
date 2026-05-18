package model

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Dataset struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	ItemCount   int64     `json:"item_count"`
	SizeBytes   int64     `json:"size_bytes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DatasetItem struct {
	ID        int64                  `json:"id"`
	DatasetID string                 `json:"dataset_id"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt time.Time              `json:"created_at"`
}

type KVStore struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type KVEntry struct {
	ID        int64     `json:"id"`
	StoreID   string    `json:"store_id"`
	Key       string    `json:"key"`
	Value     string    `json:"value"` // stored as text; can be JSON
	ContentType string  `json:"content_type"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RequestQueue struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	TotalCount  int64     `json:"total_count"`
	HandledCount int64    `json:"handled_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type QueueItemStatus string

const (
	QItemPending QueueItemStatus = "pending"
	QItemHandled QueueItemStatus = "handled"
	QItemFailed  QueueItemStatus = "failed"
)

type RequestQueueItem struct {
	ID          int64           `json:"id"`
	QueueID     string          `json:"queue_id"`
	URL         string          `json:"url"`
	Method      string          `json:"method"`
	Headers     map[string]string `json:"headers"`
	Payload     string          `json:"payload"`
	UniqueKey   string          `json:"unique_key"`
	Status      QueueItemStatus `json:"status"`
	Retries     int             `json:"retries"`
	ErrorMsg    string          `json:"error_msg,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type StorageQueries struct {
	pool *pgxpool.Pool
}

func NewStorageQueries(pool *pgxpool.Pool) *StorageQueries {
	return &StorageQueries{pool: pool}
}

// Dataset queries

func (q *StorageQueries) CreateDataset(ctx context.Context, d *Dataset) error {
	sql := `INSERT INTO datasets (id, workspace_id, name, item_count, size_bytes, created_at, updated_at)
	        VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := q.pool.Exec(ctx, sql, d.ID, d.WorkspaceID, d.Name, d.ItemCount, d.SizeBytes, d.CreatedAt, d.UpdatedAt)
	return err
}

func (q *StorageQueries) GetDataset(ctx context.Context, id string) (*Dataset, error) {
	sql := `SELECT id, workspace_id, name, item_count, size_bytes, created_at, updated_at FROM datasets WHERE id = $1`
	row := q.pool.QueryRow(ctx, sql, id)
	d := &Dataset{}
	err := row.Scan(&d.ID, &d.WorkspaceID, &d.Name, &d.ItemCount, &d.SizeBytes, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (q *StorageQueries) InsertDatasetItems(ctx context.Context, datasetID string, items []map[string]interface{}) error {
	now := time.Now().UTC()
	for _, item := range items {
		sql := `INSERT INTO dataset_items (dataset_id, data, created_at) VALUES ($1,$2,$3)`
		if _, err := q.pool.Exec(ctx, sql, datasetID, item, now); err != nil {
			return err
		}
	}
	// Update count
	update := `UPDATE datasets SET item_count = item_count + $2, updated_at = NOW() WHERE id = $1`
	_, err := q.pool.Exec(ctx, update, datasetID, int64(len(items)))
	return err
}

func (q *StorageQueries) ListDatasetItems(ctx context.Context, datasetID string, limit, offset int) ([]*DatasetItem, error) {
	sql := `SELECT id, dataset_id, data, created_at FROM dataset_items WHERE dataset_id = $1 ORDER BY id ASC LIMIT $2 OFFSET $3`
	rows, err := q.pool.Query(ctx, sql, datasetID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*DatasetItem
	for rows.Next() {
		item := &DatasetItem{}
		if err := rows.Scan(&item.ID, &item.DatasetID, &item.Data, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// KV Store queries

func (q *StorageQueries) CreateKVStore(ctx context.Context, s *KVStore) error {
	sql := `INSERT INTO kv_stores (id, workspace_id, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)`
	_, err := q.pool.Exec(ctx, sql, s.ID, s.WorkspaceID, s.Name, s.CreatedAt, s.UpdatedAt)
	return err
}

func (q *StorageQueries) GetKVStore(ctx context.Context, id string) (*KVStore, error) {
	sql := `SELECT id, workspace_id, name, created_at, updated_at FROM kv_stores WHERE id = $1`
	row := q.pool.QueryRow(ctx, sql, id)
	s := &KVStore{}
	err := row.Scan(&s.ID, &s.WorkspaceID, &s.Name, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (q *StorageQueries) UpsertKVEntry(ctx context.Context, e *KVEntry) error {
	sql := `
		INSERT INTO kv_entries (store_id, key, value, content_type, size_bytes, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (store_id, key) DO UPDATE
		SET value=$3, content_type=$4, size_bytes=$5, updated_at=$7
	`
	_, err := q.pool.Exec(ctx, sql, e.StoreID, e.Key, e.Value, e.ContentType, e.SizeBytes, e.CreatedAt, e.UpdatedAt)
	return err
}

func (q *StorageQueries) GetKVEntry(ctx context.Context, storeID, key string) (*KVEntry, error) {
	sql := `SELECT id, store_id, key, value, content_type, size_bytes, created_at, updated_at FROM kv_entries WHERE store_id=$1 AND key=$2`
	row := q.pool.QueryRow(ctx, sql, storeID, key)
	e := &KVEntry{}
	err := row.Scan(&e.ID, &e.StoreID, &e.Key, &e.Value, &e.ContentType, &e.SizeBytes, &e.CreatedAt, &e.UpdatedAt)
	return e, err
}

func (q *StorageQueries) DeleteKVEntry(ctx context.Context, storeID, key string) error {
	sql := `DELETE FROM kv_entries WHERE store_id=$1 AND key=$2`
	_, err := q.pool.Exec(ctx, sql, storeID, key)
	return err
}

func (q *StorageQueries) ListKVEntries(ctx context.Context, storeID string, limit, offset int) ([]*KVEntry, error) {
	sql := `SELECT id, store_id, key, value, content_type, size_bytes, created_at, updated_at FROM kv_entries WHERE store_id=$1 ORDER BY key LIMIT $2 OFFSET $3`
	rows, err := q.pool.Query(ctx, sql, storeID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []*KVEntry
	for rows.Next() {
		e := &KVEntry{}
		if err := rows.Scan(&e.ID, &e.StoreID, &e.Key, &e.Value, &e.ContentType, &e.SizeBytes, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// Request Queue queries

func (q *StorageQueries) CreateQueue(ctx context.Context, rq *RequestQueue) error {
	sql := `INSERT INTO request_queues (id, workspace_id, name, total_count, handled_count, created_at, updated_at)
	        VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := q.pool.Exec(ctx, sql, rq.ID, rq.WorkspaceID, rq.Name, rq.TotalCount, rq.HandledCount, rq.CreatedAt, rq.UpdatedAt)
	return err
}

func (q *StorageQueries) GetQueue(ctx context.Context, id string) (*RequestQueue, error) {
	sql := `SELECT id, workspace_id, name, total_count, handled_count, created_at, updated_at FROM request_queues WHERE id=$1`
	row := q.pool.QueryRow(ctx, sql, id)
	rq := &RequestQueue{}
	err := row.Scan(&rq.ID, &rq.WorkspaceID, &rq.Name, &rq.TotalCount, &rq.HandledCount, &rq.CreatedAt, &rq.UpdatedAt)
	return rq, err
}

func (q *StorageQueries) AddQueueItems(ctx context.Context, queueID string, items []*RequestQueueItem) error {
	now := time.Now().UTC()
	for _, item := range items {
		sql := `
			INSERT INTO request_queue_items (queue_id, url, method, headers, payload, unique_key, status, retries, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (queue_id, unique_key) DO NOTHING
		`
		if _, err := q.pool.Exec(ctx, sql,
			queueID, item.URL, item.Method, item.Headers, item.Payload, item.UniqueKey, string(QItemPending), 0, now, now,
		); err != nil {
			return err
		}
	}
	update := `UPDATE request_queues SET total_count = (SELECT COUNT(*) FROM request_queue_items WHERE queue_id=$1), updated_at=NOW() WHERE id=$1`
	_, err := q.pool.Exec(ctx, update, queueID)
	return err
}

func (q *StorageQueries) PopQueueItem(ctx context.Context, queueID string) (*RequestQueueItem, error) {
	sql := `
		UPDATE request_queue_items SET status='running', updated_at=NOW()
		WHERE id = (
			SELECT id FROM request_queue_items
			WHERE queue_id=$1 AND status='pending'
			ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
		)
		RETURNING id, queue_id, url, method, headers, payload, unique_key, status, retries, error_msg, created_at, updated_at
	`
	row := q.pool.QueryRow(ctx, sql, queueID)
	item := &RequestQueueItem{}
	err := row.Scan(&item.ID, &item.QueueID, &item.URL, &item.Method, &item.Headers, &item.Payload,
		&item.UniqueKey, &item.Status, &item.Retries, &item.ErrorMsg, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (q *StorageQueries) UpdateQueueItemStatus(ctx context.Context, itemID int64, status QueueItemStatus, errMsg string) error {
	sql := `UPDATE request_queue_items SET status=$2, error_msg=$3, updated_at=NOW() WHERE id=$1`
	_, err := q.pool.Exec(ctx, sql, itemID, string(status), errMsg)
	if err != nil {
		return err
	}
	// If handled, update queue count
	if status == QItemHandled {
		update := `UPDATE request_queues SET handled_count = handled_count + 1, updated_at=NOW() WHERE id=(SELECT queue_id FROM request_queue_items WHERE id=$1)`
		_, err = q.pool.Exec(ctx, update, itemID)
	}
	return err
}
