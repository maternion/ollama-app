//go:build linux

package main

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/ollama/ollama/app/store"
)

func startManagedServer(ctx, octx context.Context, st *store.Store, devMode bool, done chan error) (*struct{}, bool) {
	slog.Info("Linux app uses systemd service; no managed server")
	done <- nil
	return nil, false
}

func makeRestartFunc(osrv *struct{}, serverFailed bool, octx context.Context, ocancel context.CancelFunc, done chan error, ctx context.Context, st *store.Store) func() {
	return func() {
		settings, err := st.Settings()
		if err != nil {
			slog.Error("failed to read settings for restart", "error", err)
			return
		}
		env := make(map[string]string)
		if settings.Models != "" {
			env["OLLAMA_MODELS"] = settings.Models
		}
		if settings.Expose {
			env["OLLAMA_HOST"] = "0.0.0.0"
		}
		if settings.ContextLength > 0 {
			env["OLLAMA_CONTEXT_LENGTH"] = fmt.Sprintf("%d", settings.ContextLength)
		}
		if err := store.WriteSystemdDropIn(env); err != nil {
			slog.Error("failed to apply settings to systemd service", "error", err)
		}
	}
}
