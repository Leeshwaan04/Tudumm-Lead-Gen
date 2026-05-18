# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app/server ./main.go

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.20

# Docker CLI is required for Docker-in-Docker actor execution
RUN apk add --no-cache ca-certificates tzdata wget docker-cli

WORKDIR /app

COPY --from=builder /app/server ./server

# Note: runs as root so it can talk to the mounted docker.sock
# In production, add the appuser to the docker group instead.

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:8002/healthz || exit 1

ENTRYPOINT ["./server"]
