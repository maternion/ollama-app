//go:build linux

package linuxtray

/*
#cgo LDFLAGS: -ldl
#include <dlfcn.h>
#include <stdlib.h>
#include <glib-object.h>

static void* notify_handle = NULL;
static void* notify_init_ptr = NULL;
static void* notify_new_ptr = NULL;
static void* notify_show_ptr = NULL;
static void* notify_set_timeout_ptr = NULL;
static void* notify_set_urgency_ptr = NULL;

static int init_notify() {
	notify_handle = dlopen("libnotify.so.4", RTLD_NOW | RTLD_LOCAL);
	if (!notify_handle) return -1;

	notify_init_ptr = dlsym(notify_handle, "notify_init");
	notify_new_ptr = dlsym(notify_handle, "notify_notification_new");
	notify_show_ptr = dlsym(notify_handle, "notify_notification_show");
	notify_set_timeout_ptr = dlsym(notify_handle, "notify_notification_set_timeout");
	notify_set_urgency_ptr = dlsym(notify_handle, "notify_notification_set_urgency");

	if (!notify_init_ptr || !notify_new_ptr || !notify_show_ptr || !notify_set_timeout_ptr || !notify_set_urgency_ptr) {
		dlclose(notify_handle);
		notify_handle = NULL;
		return -1;
	}
	return 0;
}

typedef int (*notify_init_fn)(const char*);
typedef void* (*notify_new_fn)(const char*, const char*, const char*);
typedef int (*notify_show_fn)(void*, void*);
typedef void (*notify_set_timeout_fn)(void*, int);
typedef void (*notify_set_urgency_fn)(void*, int);

int c_notify_init(const char* app) {
	return ((notify_init_fn)notify_init_ptr)(app);
}

void* c_notify_new(const char* title, const char* body, const char* icon) {
	return ((notify_new_fn)notify_new_ptr)(title, body, icon);
}

int c_notify_show(void* n) {
	return ((notify_show_fn)notify_show_ptr)(n, NULL);
}

void c_notify_set_timeout(void* n, int ms) {
	((notify_set_timeout_fn)notify_set_timeout_ptr)(n, ms);
}

void c_notify_set_urgency(void* n, int urgency) {
	((notify_set_urgency_fn)notify_set_urgency_ptr)(n, urgency);
}

static void object_unref(void *obj) {
	g_object_unref(obj);
}
*/
import "C"

import (
	"log/slog"
	"sync"
	"unsafe"
)

var notifyOnce sync.Once

// InitNotifications initializes libnotify. Safe to call multiple times.
func InitNotifications() {
	notifyOnce.Do(func() {
		if C.init_notify() != 0 {
			slog.Debug("libnotify not available, notifications disabled")
			return
		}
		appName := C.CString("Ollama")
		defer C.free(unsafe.Pointer(appName))
		if C.c_notify_init(appName) == 0 {
			slog.Warn("libnotify initialization failed")
			return
		}
		slog.Debug("libnotify initialized")
	})
}

// ShowNotification displays a native desktop notification.
// No-op if libnotify is not available at runtime.
func ShowNotification(title, body string) {
	InitNotifications()

	cTitle := C.CString(title)
	cBody := C.CString(body)
	defer C.free(unsafe.Pointer(cTitle))
	defer C.free(unsafe.Pointer(cBody))

	n := C.c_notify_new(cTitle, cBody, nil)
	if n == nil {
		slog.Warn("failed to create notification")
		return
	}
	defer C.object_unref(n)

	C.c_notify_set_timeout(n, -1) // NOTIFY_EXPIRES_DEFAULT
	C.c_notify_set_urgency(n, 1)  // NOTIFY_URGENCY_NORMAL

	if C.c_notify_show(n) == 0 {
		slog.Warn("failed to show notification", "title", title)
	}
}
