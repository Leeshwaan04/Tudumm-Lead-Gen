package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"
)

type ProxyMap map[string]string

func RegisterRoutes(r chi.Router, logger *zap.Logger) {
	serviceMap := ProxyMap{
		"/auth":      getEnv("AUTH_SERVICE_URL", "http://auth-service:8001"),
		"/runs":      getEnv("EXECUTION_ENGINE_URL", "http://execution-engine:8002"),
		"/billing":   getEnv("BILLING_SERVICE_URL", "http://billing-service:8003"),
		"/storage":   getEnv("STORAGE_SERVICE_URL", "http://storage-service:8004"),
		"/actors":    getEnv("MARKETPLACE_SERVICE_URL", "http://marketplace-service:8005"),
		"/schedules": getEnv("SCHEDULING_SERVICE_URL", "http://scheduling-service:8006"),
		"/browser":   getEnv("BROWSER_SERVICE_URL", "http://browser-service:8007"),
		"/proxy":     getEnv("PROXY_ROUTER_URL", "http://proxy-router:8008"),
		"/enrich":    getEnv("ENRICHMENT_SERVICE_URL", "http://enrichment-service:8009"),
	}

	for path, target := range serviceMap {
		targetURL, err := url.Parse(target)
		if err != nil {
			logger.Fatal("Failed to parse target URL", zap.String("path", path), zap.String("target", target))
		}

		proxy := httputil.NewSingleHostReverseProxy(targetURL)
		
		// Custom Director to handle path stripping if needed
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Header.Set("X-Forwarded-Host", req.Host)
			req.Host = targetURL.Host
		}

		r.Handle(path+"/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Debug("Proxying request", zap.String("path", r.URL.Path), zap.String("target", target))
			proxy.ServeHTTP(w, r)
		}))
	}

	// Health check for gateway itself
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		if !strings.HasPrefix(value, "http") {
			return "http://" + value
		}
		return value
	}
	return fallback
}
