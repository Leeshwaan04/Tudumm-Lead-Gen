# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download -x 2>/dev/null; true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOFLAGS=-mod=mod \
    go build -ldflags="-w -s" -o /app/server ./main.go

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.20

# Docker CLI is required for Docker-in-Docker actor execution
RUN apk add --no-cache ca-certificates docker-cli

WORKDIR /app

COPY --from=builder /app/server ./server

# Note: runs as root so it can talk to the mounted docker.sock
# In production, add the appuser to the docker group instead.

EXPOSE 8002


ENTRYPOINT ["./server"]
