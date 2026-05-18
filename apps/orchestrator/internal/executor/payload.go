package executor

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"

	"github.com/google/uuid"
	"github.com/tudumm/orchestrator/internal/models"
)

var userAgents = []string{
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
}

var resolutions = [][2]int{{1920, 1080}, {2560, 1440}, {1440, 900}, {1366, 768}, {1280, 800}}
var timezones = []string{"America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Calcutta", "Asia/Tokyo"}
var webglVendors = []string{"Google Inc. (Apple)", "Google Inc. (NVIDIA)", "Google Inc. (Intel)"}
var webglRenderers = []string{
	"ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)",
	"ANGLE (NVIDIA, NVIDIA GeForce RTX 3080, OpenGL 4.5)",
	"ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)",
}

type BrowserFingerprint struct {
	ID             string   `json:"id"`
	UserAgent      string   `json:"user_agent"`
	ScreenWidth    int      `json:"screen_width"`
	ScreenHeight   int      `json:"screen_height"`
	Timezone       string   `json:"timezone"`
	Language       string   `json:"language"`
	WebGLVendor    string   `json:"webgl_vendor"`
	WebGLRenderer  string   `json:"webgl_renderer"`
	CanvasNoise    float64  `json:"canvas_noise"`
	HardwareCores  int      `json:"hardware_cores"`
	DeviceMemory   int      `json:"device_memory"`
}

type WorkerPayload struct {
	JobID       uuid.UUID          `json:"job_id"`
	WorkspaceID uuid.UUID          `json:"workspace_id"`
	ActorImage  string             `json:"actor_image"`
	Input       json.RawMessage    `json:"input"`
	ProxyURL    string             `json:"proxy_url"`
	Cookies     string             `json:"cookies"` // AES-encrypted
	Fingerprint BrowserFingerprint `json:"fingerprint"`
	OrchestratorGRPCAddr string   `json:"orchestrator_grpc_addr"`
}

func randInt(max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max)))
	return int(n.Int64())
}

func randFloat() float64 {
	n, _ := rand.Int(rand.Reader, big.NewInt(10000))
	return float64(n.Int64())/10000000.0 + 0.0001
}

func GenerateFingerprint() BrowserFingerprint {
	res := resolutions[randInt(len(resolutions))]
	cores := []int{2, 4, 8, 12, 16}
	mems := []int{4, 8, 16}
	return BrowserFingerprint{
		ID:            uuid.New().String(),
		UserAgent:     userAgents[randInt(len(userAgents))],
		ScreenWidth:   res[0],
		ScreenHeight:  res[1],
		Timezone:      timezones[randInt(len(timezones))],
		Language:      "en-US",
		WebGLVendor:   webglVendors[randInt(len(webglVendors))],
		WebGLRenderer: webglRenderers[randInt(len(webglRenderers))],
		CanvasNoise:   randFloat(),
		HardwareCores: cores[randInt(len(cores))],
		DeviceMemory:  mems[randInt(len(mems))],
	}
}

func BuildPayload(job *models.Job, proxyURL string, encryptedCookies string) (*WorkerPayload, error) {
	fp := GenerateFingerprint()
	return &WorkerPayload{
		JobID:                job.ID,
		WorkspaceID:          job.WorkspaceID,
		ActorImage:           job.ActorImage,
		Input:                job.Input,
		ProxyURL:             proxyURL,
		Cookies:              encryptedCookies,
		Fingerprint:          fp,
		OrchestratorGRPCAddr: os.Getenv("ORCHESTRATOR_GRPC_ADDR"),
	}, nil
}

func EncryptPayload(payload *WorkerPayload) (string, error) {
	key := []byte(os.Getenv("PAYLOAD_ENCRYPTION_KEY"))
	if len(key) != 32 {
		return "", fmt.Errorf("PAYLOAD_ENCRYPTION_KEY must be 32 bytes")
	}
	plaintext, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}
