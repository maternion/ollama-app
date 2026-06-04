//go:build linux

package linuxtray

/*
#cgo LDFLAGS: -ldl
#include <dlfcn.h>
#include <stdlib.h>

typedef void (*notify_notification_new_fn)(const char*, const char*, const char*);
typedef int (*notify_notification_show_fn)(void*, void*);
typedef void (*notify_notification_set_timeout_fn)(void*, int);
typedef void (*notify_notification_set_urgency_fn)(void*, int);

static void* load_notify() {
	return dlopen("libnotify.so.4", RTLD_LAZY | RTLD_LOCAL);
}

static void* load_notify_init(void* handle) {
	return dlsym(handle, "notify_init");
}

static void* load_notify_new(void* handle) {
	return dlsym(handle, "notify_notification_new");
}

static void* load_notify_show(void* handle) {
	return dlsym(handle, "notify_notification_show");
}

static void* load_notify_set_timeout(void* handle) {
	return dlsym(handle, "notify_notification_set_timeout");
}

static void* load_notify_set_urgency(void* handle) {
	return dlsym(handle, "notify_notification_set_urgency");
}
*/
import "C"

import (
	"log/slog"
	"unsafe"
)

var (
	notifyLoaded     bool
	notifyInit       func(appName string) bool
	notifyNew        func(title, body, icon string) unsafe.Pointer
	notifyShow       func(n unsafe.Pointer) bool
	notifySetTimeout func(n unsafe.Pointer, ms int)
	notifySetUrgency func(n unsafe.Pointer, urgency int)
)

func loadLibnotify() bool {
	handle := C.load_notify()
	if handle == nil {
		return false
	}

	initPtr := C.load_notify_init(handle)
	newPtr := C.load_notify_new(handle)
	showPtr := C.load_notify_show(handle)
	timeoutPtr := C.load_notify_set_timeout(handle)
	urgencyPtr := C.load_notify_set_urgency(handle)

	if initPtr == nil || newPtr == nil || showPtr == nil || timeoutPtr == nil || urgencyPtr == nil {
		return false
	}

	notifyInit = func(appName string) bool {
		cName := C.CString(appName)
		defer C.free(unsafe.Pointer(cName))
		type initFn func(*C.char) C.int
		cfn := *(*initFn)(unsafe.Pointer(&initPtr))
		return cfn(cName) != 0
	}

	notifyNew = func(title, body, icon string) unsafe.Pointer {
		cTitle := C.CString(title)
		cBody := C.CString(body)
		var cIcon *C.char
		if icon != "" {
			cIcon = C.CString(icon)
		}
		defer C.free(unsafe.Pointer(cTitle))
		defer C.free(unsafe.Pointer(cBody))
		if cIcon != nil {
			defer C.free(unsafe.Pointer(cIcon))
		}
		type newFn func(*C.char, *C.char, *C.char) unsafe.Pointer
		cfn := *(*newFn)(unsafe.Pointer(&newPtr))
		return cfn(cTitle, cBody, cIcon)
	}

	notifyShow = func(n unsafe.Pointer) bool {
		type showFn func(unsafe.Pointer, unsafe.Pointer) C.int
		cfn := *(*showFn)(unsafe.Pointer(&showPtr))
		return cfn(n, nil) != 0
	}

	notifySetTimeout = func(n unsafe.Pointer, ms int) {
		type timeoutFn func(unsafe.Pointer, C.int)
		cfn := *(*timeoutFn)(unsafe.Pointer(&timeoutPtr))
		cfn(n, C.int(ms))
	}

	notifySetUrgency = func(n unsafe.Pointer, urgency int) {
		type urgencyFn func(unsafe.Pointer, C.int)
		cfn := *(*urgencyFn)(unsafe.Pointer(&urgencyPtr))
		cfn(n, C.int(urgency))
	}

	notifyLoaded = true
	return true
}

// InitNotifications initializes libnotify. Safe to call multiple times.
func InitNotifications() {
	if notifyLoaded {
		return
	}
	if !loadLibnotify() {
		slog.Debug("libnotify not available, notifications disabled")
		return
	}
	if !notifyInit("Ollama") {
		slog.Warn("libnotify initialization failed")
		notifyLoaded = false
		return
	}
	slog.Debug("libnotify initialized")
}

// ShowNotification displays a native desktop notification.
// No-op if libnotify is not available at runtime.
func ShowNotification(title, body string) {
	if !notifyLoaded {
		InitNotifications()
		if !notifyLoaded {
			return
		}
	}

	n := notifyNew(title, body, "")
	if n == nil {
		slog.Warn("failed to create notification")
		return
	}

	notifySetTimeout(n, -1) // NOTIFY_EXPIRES_DEFAULT
	notifySetUrgency(n, 1)  // NOTIFY_URGENCY_NORMAL

	if !notifyShow(n) {
		slog.Warn("failed to show notification", "title", title)
	}
}
