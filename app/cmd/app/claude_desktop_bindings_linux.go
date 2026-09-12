//go:build linux

package main

import "github.com/ollama/ollama/app/webview"

// bindClaudeDesktop registers Claude Desktop integration bindings with the
// webview. Claude Desktop is not supported on Linux, so this is a no-op.
func bindClaudeDesktop(_ webview.WebView) {}
