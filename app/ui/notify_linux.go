//go:build linux

package ui

import "github.com/ollama/ollama/app/linuxtray"

func showNotification(title, body string) {
	linuxtray.ShowNotification(title, body)
}
