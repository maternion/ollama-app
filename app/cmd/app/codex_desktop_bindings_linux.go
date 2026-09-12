//go:build linux

package main

import "github.com/ollama/ollama/app/webview"

// bindCodexDesktop registers ChatGPT desktop bindings with the webview.
// ChatGPT Desktop is not supported on Linux, so this is a no-op.
func bindCodexDesktop(_ webview.WebView) {}
