package service

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/tudumm/execution-engine/internal/config"
	"github.com/tudumm/execution-engine/internal/model"
	"go.uber.org/zap"
)

type ExecutorService struct {
	docker  *client.Client
	queries *model.RunQueries
	cfg     *config.Config
	log     *zap.Logger

	mu       sync.Mutex
	running  map[string]context.CancelFunc // runID -> cancel
}

func NewExecutorService(docker *client.Client, queries *model.RunQueries, cfg *config.Config, log *zap.Logger) *ExecutorService {
	return &ExecutorService{
		docker:  docker,
		queries: queries,
		cfg:     cfg,
		log:     log,
		running: make(map[string]context.CancelFunc),
	}
}

// Execute runs a job end-to-end: pull image → create container → run → collect output.
func (e *ExecutorService) Execute(ctx context.Context, msg *RunMessage) error {
	runCtx, cancel := context.WithCancel(ctx)
	e.mu.Lock()
	e.running[msg.RunID] = cancel
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.running, msg.RunID)
		e.mu.Unlock()
		cancel()
	}()

	// Pull image
	e.log.Info("pulling image", zap.String("run_id", msg.RunID), zap.String("image", msg.ImageName))
	pullResp, err := e.docker.ImagePull(runCtx, msg.ImageName, types.ImagePullOptions{})
	if err != nil {
		return e.failRun(ctx, msg.RunID, fmt.Sprintf("image pull failed: %v", err))
	}
	io.Copy(io.Discard, pullResp) //nolint:errcheck
	pullResp.Close()

	// Encode input as env var
	inputJSON, _ := json.Marshal(msg.Input)

	memBytes := int64(msg.MemoryMB) * 1024 * 1024

	// Create container
	containerCfg := &container.Config{
		Image: msg.ImageName,
		Env: []string{
			"TUDUMM_INPUT=" + string(inputJSON),
			"TUDUMM_RUN_ID=" + msg.RunID,
			"BROWSER_SERVICE_URL=" + e.cfg.BrowserServiceURL,
			"PROXY_ROUTER_URL=" + e.cfg.ProxyRouterURL,
			"ENRICHMENT_SERVICE_URL=" + e.cfg.EnrichmentServiceURL,
		},
		Labels: map[string]string{
			"tudumm.run_id":       msg.RunID,
			"tudumm.workspace_id": msg.WorkspaceID,
		},
	}
	hostCfg := &container.HostConfig{
		Resources: container.Resources{
			Memory:    memBytes,
			CPUQuota:  msg.CPUQuota,
			CPUPeriod: 100000,
			PidsLimit: func() *int64 { v := int64(100); return &v }(),
		},
		NetworkMode:    "bridge",
		ReadonlyRootfs: false,
		AutoRemove:     false,
	}

	created, err := e.docker.ContainerCreate(runCtx, containerCfg, hostCfg, nil, nil, "")
	if err != nil {
		return e.failRun(ctx, msg.RunID, fmt.Sprintf("container create failed: %v", err))
	}
	containerID := created.ID

	if err := e.queries.UpdateRunStarted(ctx, msg.RunID, containerID); err != nil {
		e.log.Error("update run started", zap.Error(err))
	}

	// Start container
	if err := e.docker.ContainerStart(runCtx, containerID, types.ContainerStartOptions{}); err != nil {
		_ = e.docker.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true})
		return e.failRun(ctx, msg.RunID, fmt.Sprintf("container start failed: %v", err))
	}

	// Stream logs
	logReader, err := e.docker.ContainerLogs(runCtx, containerID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Timestamps: true,
	})
	if err != nil {
		e.log.Error("get container logs", zap.Error(err))
	} else {
		go e.streamLogs(ctx, msg.RunID, logReader)
	}

	// Wait for completion
	statusCh, errCh := e.docker.ContainerWait(runCtx, containerID, container.WaitConditionNotRunning)
	var exitCode int
	var runErr string

	select {
	case result := <-statusCh:
		exitCode = int(result.StatusCode)
		if result.Error != nil {
			runErr = result.Error.Message
		}
	case err := <-errCh:
		if err != nil {
			runErr = err.Error()
			exitCode = -1
		}
	case <-runCtx.Done():
		// Cancelled
		_ = e.docker.ContainerStop(ctx, containerID, container.StopOptions{})
		_ = e.queries.UpdateRunFinished(ctx, msg.RunID, model.StatusCancelled, -1, "run cancelled", nil)
		_ = e.docker.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true})
		return nil
	}

	// Collect output from container labels or stdout — here we read a JSON file if exists
	output := e.collectOutput(ctx, containerID)

	status := model.StatusSuccess
	if exitCode != 0 || runErr != "" {
		status = model.StatusFailed
	}

	if err := e.queries.UpdateRunFinished(ctx, msg.RunID, status, exitCode, runErr, output); err != nil {
		e.log.Error("update run finished", zap.Error(err))
	}

	// Cleanup container
	_ = e.docker.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true})

	e.log.Info("run completed",
		zap.String("run_id", msg.RunID),
		zap.String("status", string(status)),
		zap.Int("exit_code", exitCode),
	)
	return nil
}

func (e *ExecutorService) CancelRun(runID string) bool {
	e.mu.Lock()
	cancel, ok := e.running[runID]
	e.mu.Unlock()
	if ok {
		cancel()
	}
	return ok
}

func (e *ExecutorService) failRun(ctx context.Context, runID, msg string) error {
	e.log.Error("run failed", zap.String("run_id", runID), zap.String("reason", msg))
	exitCode := -1
	_ = e.queries.UpdateRunFinished(ctx, runID, model.StatusFailed, exitCode, msg, nil)
	return fmt.Errorf("%s", msg)
}

func (e *ExecutorService) streamLogs(ctx context.Context, runID string, r io.ReadCloser) {
	defer r.Close()
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		// Docker multiplexes stdout/stderr — strip the 8-byte header
		stream := "stdout"
		if len(line) > 8 {
			if line[0] == 2 {
				stream = "stderr"
			}
			line = line[8:]
		}
		log := &model.RunLog{
			RunID:     runID,
			Stream:    stream,
			Line:      line,
			CreatedAt: time.Now().UTC(),
		}
		if err := e.queries.InsertLog(ctx, log); err != nil {
			e.log.Error("insert log", zap.Error(err))
		}
	}
}

func (e *ExecutorService) collectOutput(ctx context.Context, containerID string) map[string]interface{} {
	// Attempt to read /tudumm/output.json from the container
	reader, _, err := e.docker.CopyFromContainer(ctx, containerID, "/tudumm/output.json")
	if err != nil {
		return nil
	}
	defer reader.Close()

	var output map[string]interface{}
	if err := json.NewDecoder(reader).Decode(&output); err != nil {
		return nil
	}
	return output
}
