//go:build !linux

package ui

func showNotification(title, body string) {
	// Not supported on this platform
}
