//go:build linux

package linuxtray

/*
#cgo pkg-config: libnotify
#include <libnotify/notify.h>
#include <stdlib.h>
*/
import "C"

import (
	"log/slog"
	"unsafe"
)

var notificationsInited bool

// InitNotifications initializes the libnotify library. Safe to call multiple times.
func InitNotifications() {
	if notificationsInited {
		return
	}
	cName := C.CString("Ollama")
	defer C.free(unsafe.Pointer(cName))
	if C.notify_init(cName) != 0 {
		notificationsInited = true
		slog.Debug("libnotify initialized")
	} else {
		slog.Warn("libnotify initialization failed, notifications disabled")
	}
}

// ShowNotification displays a native desktop notification using libnotify.
func ShowNotification(title, body string) {
	if !notificationsInited {
		InitNotifications()
		if !notificationsInited {
			return
		}
	}

	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cBody := C.CString(body)
	defer C.free(unsafe.Pointer(cBody))

	notification := C.notify_notification_new(cTitle, cBody, nil)
	if notification == nil {
		slog.Warn("failed to create libnotify notification")
		return
	}
	defer C.g_object_unref(C.gpointer(notification))

	C.notify_notification_set_timeout(notification, C.NOTIFY_EXPIRES_DEFAULT)
	C.notify_notification_set_urgency(notification, C.NOTIFY_URGENCY_NORMAL)

	if C.notify_notification_show(notification, nil) == 0 {
		slog.Warn("failed to show notification", "title", title)
	}
}