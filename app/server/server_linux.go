//go:build linux

package server

import (
	"context"
	"log/slog"
	"time"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/app/store"
)

// InferenceCompute describes detected GPU compute capabilities (stub on Linux).
type InferenceCompute struct {
	Library string
	Variant string
	Compute string
	Driver  string
	Name    string
	VRAM    string
}

// InferenceInfo holds compute info and default context length (stub on Linux).
type InferenceInfo struct {
	Computes             []InferenceCompute
	DefaultContextLength int
}

// IsServerRunning ensures only the systemd ollama service is running, then checks
// if it's reachable. Kills any rogue ollama serve processes blocking port 11434.
func IsServerRunning(ctx context.Context) bool {
	if !store.EnsureSystemdServiceRunning() {
		slog.Error("failed to ensure systemd ollama service is running")
		return false
	}

	c, err := api.ClientFromEnvironment()
	if err != nil {
		slog.Debug("failed to create ollama client", "error", err)
		return false
	}

	// Give the service time to become ready
	for i := 0; i < 10; i++ {
		if _, err := c.Version(ctx); err == nil {
			slog.Info("connected to systemd ollama service")
			return true
		}
		time.Sleep(500 * time.Millisecond)
	}
	slog.Warn("systemd ollama service is not responding on port 11434")
	return false
}

// GetInferenceInfo returns stub info since the app doesn't manage the server process on Linux.
func GetInferenceInfo(ctx context.Context) (*InferenceInfo, error) {
	return &InferenceInfo{
		DefaultContextLength: 4096,
	}, nil
}