//go:build windows || darwin

package main

import (
	"context"
	"errors"
	"log/slog"

	"github.com/ollama/ollama/app/server"
	"github.com/ollama/ollama/app/store"
)

func startManagedServer(ctx, octx context.Context, st *store.Store, devMode bool, done chan error) (any, bool) {
	var serverFailed bool
	osrv := server.New(st, devMode)
	go func() {
		slog.Info("starting ollama server")
		err := osrv.Run(octx)
		if err != nil && !errors.Is(err, context.Canceled) {
			serverFailed = true
			slog.Error("ollama server exited with error", "error", err)
		}
		done <- err
	}()
	return osrv, serverFailed
}

func makeRestartFunc(osrv any, serverFailed bool, octx context.Context, ocancel context.CancelFunc, done chan error, ctx context.Context, st *store.Store) func() {
	srv, _ := osrv.(*server.Server)
	return func() {
		if srv == nil {
			slog.Warn("not restarting ollama server: using external server")
			return
		}
		if serverFailed {
			slog.Warn("not restarting ollama server: previous run failed")
			return
		}
		ocancel()
		<-done
		nctx, ncancel := context.WithCancel(ctx)
		octx = nctx
		ocancel = ncancel
		go func() {
			err := srv.Run(octx)
			if err != nil && !errors.Is(err, context.Canceled) {
				serverFailed = true
				slog.Error("ollama server exited with error", "error", err)
			}
			done <- err
		}()
	}
}