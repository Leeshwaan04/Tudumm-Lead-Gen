package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type RedisStore struct {
	rdb *redis.Client
}

func NewRedisStore(rdb *redis.Client) *RedisStore {
	return &RedisStore{rdb: rdb}
}

func (s *RedisStore) EnqueueJob(ctx context.Context, payload map[string]interface{}) error {
	return s.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "jobs:queue",
		Values: payload,
	}).Err()
}

func (s *RedisStore) SetJobStatus(ctx context.Context, jobID uuid.UUID, status string) error {
	return s.rdb.Set(ctx, fmt.Sprintf("job:status:%s", jobID), status, 24*time.Hour).Err()
}

func (s *RedisStore) GetJobStatus(ctx context.Context, jobID uuid.UUID) (string, error) {
	return s.rdb.Get(ctx, fmt.Sprintf("job:status:%s", jobID)).Result()
}

func (s *RedisStore) SetJobAbort(ctx context.Context, jobID uuid.UUID) error {
	return s.rdb.Set(ctx, fmt.Sprintf("job:abort:%s", jobID), "1", 1*time.Hour).Err()
}

func (s *RedisStore) IsJobAborted(ctx context.Context, jobID uuid.UUID) bool {
	v, err := s.rdb.Get(ctx, fmt.Sprintf("job:abort:%s", jobID)).Result()
	return err == nil && v == "1"
}

func (s *RedisStore) IncrBandwidthUsage(ctx context.Context, workspaceID uuid.UUID, bytes int64) error {
	key := fmt.Sprintf("bandwidth:%s:%s", workspaceID, time.Now().UTC().Format("2006-01-02"))
	pipe := s.rdb.Pipeline()
	pipe.IncrBy(ctx, key, bytes)
	pipe.Expire(ctx, key, 32*24*time.Hour)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *RedisStore) AcquireLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	ok, err := s.rdb.SetNX(ctx, "lock:"+key, "1", ttl).Result()
	return ok, err
}

func (s *RedisStore) ReleaseLock(ctx context.Context, key string) error {
	return s.rdb.Del(ctx, "lock:"+key).Err()
}

func (s *RedisStore) UpdateHeartbeat(ctx context.Context, jobID uuid.UUID) error {
	return s.rdb.Set(ctx, fmt.Sprintf("job:heartbeat:%s", jobID), time.Now().UTC().Unix(), 2*time.Minute).Err()
}
