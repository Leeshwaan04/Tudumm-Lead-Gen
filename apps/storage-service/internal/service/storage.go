package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/tudumm/storage-service/internal/model"
)

type StorageService struct {
	db    *pgxpool.Pool
	minio *minio.Client
	bucket string
}

func NewStorageService(db *pgxpool.Pool, minioClient *minio.Client, bucket string) *StorageService {
	return &StorageService{db: db, minio: minioClient, bucket: bucket}
}

// ── Datasets ──────────────────────────────────────────────────────────────────

func (s *StorageService) CreateDataset(ctx context.Context, workspaceID, name string) (*model.Dataset, error) {
	ds := &model.Dataset{
		WorkspaceID: workspaceID,
		Name:        name,
		CreatedAt:   time.Now(),
	}
	err := s.db.QueryRow(ctx,
		`INSERT INTO datasets (workspace_id, name, item_count, size_bytes, created_at)
		 VALUES ($1, $2, 0, 0, $3) RETURNING id`,
		workspaceID, name, ds.CreatedAt,
	).Scan(&ds.ID)
	return ds, err
}

func (s *StorageService) GetDataset(ctx context.Context, id string) (*model.Dataset, error) {
	ds := &model.Dataset{}
	err := s.db.QueryRow(ctx,
		`SELECT id, workspace_id, name, item_count, size_bytes, created_at FROM datasets WHERE id = $1`,
		id,
	).Scan(&ds.ID, &ds.WorkspaceID, &ds.Name, &ds.ItemCount, &ds.SizeBytes, &ds.CreatedAt)
	return ds, err
}

func (s *StorageService) ListDatasets(ctx context.Context, workspaceID string) ([]*model.Dataset, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, workspace_id, name, item_count, size_bytes, created_at
		 FROM datasets WHERE workspace_id = $1 ORDER BY created_at DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var datasets []*model.Dataset
	for rows.Next() {
		ds := &model.Dataset{}
		if err := rows.Scan(&ds.ID, &ds.WorkspaceID, &ds.Name, &ds.ItemCount, &ds.SizeBytes, &ds.CreatedAt); err != nil {
			return nil, err
		}
		datasets = append(datasets, ds)
	}
	return datasets, nil
}

func (s *StorageService) PushDatasetItems(ctx context.Context, datasetID string, items []map[string]any) (int, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	pushed := 0
	totalBytes := 0
	for _, item := range items {
		data, err := json.Marshal(item)
		if err != nil {
			continue
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO dataset_items (dataset_id, data, created_at) VALUES ($1, $2, $3)`,
			datasetID, data, time.Now(),
		)
		if err != nil {
			return pushed, err
		}
		pushed++
		totalBytes += len(data)
	}

	_, err = tx.Exec(ctx,
		`UPDATE datasets SET item_count = item_count + $1, size_bytes = size_bytes + $2 WHERE id = $3`,
		pushed, totalBytes, datasetID,
	)
	if err != nil {
		return pushed, err
	}
	return pushed, tx.Commit(ctx)
}

func (s *StorageService) GetDatasetItems(ctx context.Context, datasetID string, page, limit int) ([]model.DatasetItem, int, error) {
	offset := (page - 1) * limit

	var total int
	s.db.QueryRow(ctx, `SELECT item_count FROM datasets WHERE id = $1`, datasetID).Scan(&total)

	rows, err := s.db.Query(ctx,
		`SELECT id, data, created_at FROM dataset_items WHERE dataset_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
		datasetID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []model.DatasetItem
	for rows.Next() {
		var item model.DatasetItem
		var rawData []byte
		if err := rows.Scan(&item.ID, &rawData, &item.CreatedAt); err != nil {
			return nil, 0, err
		}
		json.Unmarshal(rawData, &item.Data)
		item.DatasetID = datasetID
		items = append(items, item)
	}
	return items, total, nil
}

// ── KV Stores ─────────────────────────────────────────────────────────────────

func (s *StorageService) CreateKVStore(ctx context.Context, workspaceID, name string) (*model.KVStore, error) {
	store := &model.KVStore{WorkspaceID: workspaceID, Name: name, CreatedAt: time.Now()}
	err := s.db.QueryRow(ctx,
		`INSERT INTO kv_stores (workspace_id, name, item_count, size_bytes, created_at) VALUES ($1,$2,0,0,$3) RETURNING id`,
		workspaceID, name, store.CreatedAt,
	).Scan(&store.ID)
	return store, err
}

func (s *StorageService) ListKVStores(ctx context.Context, workspaceID string) ([]*model.KVStore, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, workspace_id, name, item_count, size_bytes, created_at FROM kv_stores WHERE workspace_id = $1 ORDER BY created_at DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var stores []*model.KVStore
	for rows.Next() {
		st := &model.KVStore{}
		rows.Scan(&st.ID, &st.WorkspaceID, &st.Name, &st.ItemCount, &st.SizeBytes, &st.CreatedAt)
		stores = append(stores, st)
	}
	return stores, nil
}

func (s *StorageService) GetKVEntry(ctx context.Context, storeID, key string) (*model.KVEntryWithValue, error) {
	var entry model.KVEntryWithValue
	var s3Key string
	err := s.db.QueryRow(ctx,
		`SELECT id, store_id, key, content_type, size_bytes, s3_key FROM kv_entries WHERE store_id = $1 AND key = $2`,
		storeID, key,
	).Scan(&entry.ID, &entry.StoreID, &entry.Key, &entry.ContentType, &entry.SizeBytes, &s3Key)
	if err != nil {
		return nil, err
	}
	obj, err := s.minio.GetObject(ctx, s.bucket, s3Key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	buf := make([]byte, entry.SizeBytes)
	obj.Read(buf)
	entry.Value = buf
	return &entry, nil
}

func (s *StorageService) SetKVEntry(ctx context.Context, storeID, key, contentType string, value []byte) error {
	hash := sha256.Sum256([]byte(fmt.Sprintf("%s/%s", storeID, key)))
	s3Key := fmt.Sprintf("kv/%s/%s/%s", storeID, key, hex.EncodeToString(hash[:8]))

	_, err := s.minio.PutObject(ctx, s.bucket, s3Key,
		newBytesReader(value), int64(len(value)),
		minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx,
		`INSERT INTO kv_entries (store_id, key, content_type, size_bytes, s3_key, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 ON CONFLICT (store_id, key) DO UPDATE SET content_type=$3, size_bytes=$4, s3_key=$5, updated_at=$6`,
		storeID, key, contentType, len(value), s3Key, time.Now(),
	)
	return err
}

func (s *StorageService) DeleteKVEntry(ctx context.Context, storeID, key string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM kv_entries WHERE store_id=$1 AND key=$2`, storeID, key)
	return err
}

func (s *StorageService) ListKVKeys(ctx context.Context, storeID string) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT key FROM kv_entries WHERE store_id=$1 ORDER BY key`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var k string
		rows.Scan(&k)
		keys = append(keys, k)
	}
	return keys, nil
}

// ── Request Queues ────────────────────────────────────────────────────────────

func (s *StorageService) CreateQueue(ctx context.Context, workspaceID, name string) (*model.RequestQueue, error) {
	q := &model.RequestQueue{WorkspaceID: workspaceID, Name: name, CreatedAt: time.Now()}
	err := s.db.QueryRow(ctx,
		`INSERT INTO request_queues (workspace_id, name, pending_count, handled_count, created_at) VALUES ($1,$2,0,0,$3) RETURNING id`,
		workspaceID, name, q.CreatedAt,
	).Scan(&q.ID)
	return q, err
}

func (s *StorageService) GetQueue(ctx context.Context, id string) (*model.RequestQueue, error) {
	q := &model.RequestQueue{}
	err := s.db.QueryRow(ctx,
		`SELECT id, workspace_id, name, pending_count, handled_count, created_at FROM request_queues WHERE id=$1`, id,
	).Scan(&q.ID, &q.WorkspaceID, &q.Name, &q.PendingCount, &q.HandledCount, &q.CreatedAt)
	return q, err
}

func (s *StorageService) AddQueueItems(ctx context.Context, queueID string, items []struct {
	URL       string `json:"url"`
	UniqueKey string `json:"uniqueKey"`
}) (int, int, error) {
	added, deduped := 0, 0
	for _, item := range items {
		uk := item.UniqueKey
		if uk == "" {
			h := sha256.Sum256([]byte(item.URL))
			uk = hex.EncodeToString(h[:])
		}
		tag, err := s.db.Exec(ctx,
			`INSERT INTO request_queue_items (queue_id, url, unique_key, status, retries, added_at)
			 VALUES ($1,$2,$3,'PENDING',0,$4) ON CONFLICT (queue_id, unique_key) DO NOTHING`,
			queueID, item.URL, uk, time.Now(),
		)
		if err != nil {
			continue
		}
		if tag.RowsAffected() > 0 {
			added++
		} else {
			deduped++
		}
	}
	s.db.Exec(ctx, `UPDATE request_queues SET pending_count = pending_count + $1 WHERE id = $2`, added, queueID)
	return added, deduped, nil
}

func (s *StorageService) FetchNextQueueItem(ctx context.Context, queueID string) (*model.RequestQueueItem, error) {
	item := &model.RequestQueueItem{}
	err := s.db.QueryRow(ctx,
		`UPDATE request_queue_items SET status='RUNNING'
		 WHERE id = (SELECT id FROM request_queue_items WHERE queue_id=$1 AND status='PENDING' ORDER BY added_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
		 RETURNING id, queue_id, url, unique_key, status, retries, added_at`,
		queueID,
	).Scan(&item.ID, &item.QueueID, &item.URL, &item.UniqueKey, &item.Status, &item.Retries, &item.AddedAt)
	return item, err
}

func (s *StorageService) MarkQueueItem(ctx context.Context, queueID, itemID, status string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE request_queue_items SET status=$1, handled_at=$2 WHERE id=$3 AND queue_id=$4`,
		status, time.Now(), itemID, queueID,
	)
	if status == "HANDLED" {
		s.db.Exec(ctx, `UPDATE request_queues SET pending_count=pending_count-1, handled_count=handled_count+1 WHERE id=$1`, queueID)
	}
	return err
}

// ── helpers ───────────────────────────────────────────────────────────────────

type bytesReader struct {
	data   []byte
	offset int
}

func newBytesReader(data []byte) *bytesReader { return &bytesReader{data: data} }

func (r *bytesReader) Read(p []byte) (int, error) {
	if r.offset >= len(r.data) {
		return 0, fmt.Errorf("EOF")
	}
	n := copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}
