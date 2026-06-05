//go:build linux

package tools

import "context"

func WithAllowedDirectURLs(ctx context.Context, _ string) context.Context {
	return ctx
}

func addAllowedDirectURL(_ context.Context, _ string) {}

func allowedDirectURL(_ context.Context, _ string) bool {
	return true
}
