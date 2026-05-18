-- Tudumm ClickHouse Analytical Schema
-- Engine: MergeTree family for high-throughput time-series analytics

CREATE DATABASE IF NOT EXISTS tudumm;

USE tudumm;

-- ─────────────────────────────────────────────
-- run_metrics
-- One row per actor run; used for billing, performance, and trend dashboards.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS run_metrics
(
    run_id         String,
    workspace_id   String,
    actor_id       String,
    actor_version  String          DEFAULT '',
    duration_ms    UInt64,
    records_count  UInt64          DEFAULT 0,
    credits_cost   UInt32          DEFAULT 0,
    memory_mb      UInt32          DEFAULT 0,
    cpu_seconds    Float32         DEFAULT 0,
    status         LowCardinality(String),   -- SUCCEEDED | FAILED | CANCELLED | TIMEOUT
    exit_code      Int8            DEFAULT 0,
    created_at     DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, actor_id, created_at)
TTL created_at + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;


-- ─────────────────────────────────────────────
-- proxy_requests
-- One row per proxied HTTP request; used for bandwidth billing and geo analytics.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proxy_requests
(
    request_id        String,
    workspace_id      String,
    proxy_type        LowCardinality(String),  -- RESIDENTIAL | DATACENTER | ISP | MOBILE
    domain            String,
    country           LowCardinality(String)   DEFAULT '',
    city              String                   DEFAULT '',
    success           UInt8,                   -- 1 = success, 0 = failure
    status_code       UInt16                   DEFAULT 0,
    latency_ms        UInt32,
    bytes_transferred UInt64,
    created_at        DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, proxy_type, created_at)
TTL created_at + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;


-- ─────────────────────────────────────────────
-- credit_usage
-- Append-only ledger for credit transactions; used for billing analytics.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_usage
(
    transaction_id   String,
    workspace_id     String,
    transaction_type LowCardinality(String),  -- DEBIT | CREDIT | REFUND
    amount           Int64,
    balance_after    Int64,
    run_id           String                   DEFAULT '',
    actor_id         String                   DEFAULT '',
    description      String                   DEFAULT '',
    created_at       DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, created_at)
TTL created_at + INTERVAL 3 YEAR
SETTINGS index_granularity = 8192;


-- ─────────────────────────────────────────────
-- actor_usage
-- Per-actor revenue tracking for marketplace developer payouts.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actor_usage
(
    actor_id       String,
    workspace_id   String,
    run_id         String,
    author_id      String          DEFAULT '',
    revenue_micros Int64,           -- revenue in millionths of a USD cent
    units          UInt64          DEFAULT 0,
    event_type     LowCardinality(String) DEFAULT '',
    created_at     DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (actor_id, created_at)
TTL created_at + INTERVAL 3 YEAR
SETTINGS index_granularity = 8192;


-- ─────────────────────────────────────────────
-- api_requests
-- API gateway request log for rate limiting, latency, and error-rate dashboards.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_requests
(
    request_id   String,
    workspace_id String                   DEFAULT '',
    api_key_id   String                   DEFAULT '',
    endpoint     String,
    method       LowCardinality(String),  -- GET | POST | PUT | DELETE | PATCH
    status_code  UInt16,
    latency_ms   UInt32,
    request_size UInt32                   DEFAULT 0,
    response_size UInt32                  DEFAULT 0,
    user_agent   String                   DEFAULT '',
    ip_address   String                   DEFAULT '',
    error_message String                  DEFAULT '',
    created_at   DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, endpoint, created_at)
TTL created_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;


-- ─────────────────────────────────────────────
-- Materialized Views for common aggregations
-- ─────────────────────────────────────────────

-- Daily run summary per workspace
CREATE TABLE IF NOT EXISTS run_metrics_daily
(
    date         Date,
    workspace_id String,
    actor_id     String,
    total_runs   UInt64,
    succeeded    UInt64,
    failed       UInt64,
    total_ms     UInt64,
    total_credits UInt64,
    total_records UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (workspace_id, actor_id, date);

CREATE MATERIALIZED VIEW IF NOT EXISTS run_metrics_daily_mv
TO run_metrics_daily AS
SELECT
    toDate(created_at)  AS date,
    workspace_id,
    actor_id,
    count()             AS total_runs,
    countIf(status = 'SUCCEEDED') AS succeeded,
    countIf(status = 'FAILED')    AS failed,
    sum(duration_ms)    AS total_ms,
    sum(credits_cost)   AS total_credits,
    sum(records_count)  AS total_records
FROM run_metrics
GROUP BY date, workspace_id, actor_id;


-- Daily proxy bandwidth per workspace
CREATE TABLE IF NOT EXISTS proxy_bandwidth_daily
(
    date             Date,
    workspace_id     String,
    proxy_type       LowCardinality(String),
    total_requests   UInt64,
    successful       UInt64,
    bytes_transferred UInt64,
    avg_latency_ms   Float32
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (workspace_id, proxy_type, date);

CREATE MATERIALIZED VIEW IF NOT EXISTS proxy_bandwidth_daily_mv
TO proxy_bandwidth_daily AS
SELECT
    toDate(created_at)         AS date,
    workspace_id,
    proxy_type,
    count()                    AS total_requests,
    countIf(success = 1)       AS successful,
    sum(bytes_transferred)     AS bytes_transferred,
    avg(latency_ms)            AS avg_latency_ms
FROM proxy_requests
GROUP BY date, workspace_id, proxy_type;
