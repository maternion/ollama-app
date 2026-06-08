//go:build linux

package linuxtray

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"unsafe"

	"github.com/ollama/ollama/app/assets"
)

/*
#cgo pkg-config: ayatana-appindicator3-0.1 gtk+-3.0
#include <stdlib.h>
#include <libayatana-appindicator/app-indicator.h>
#include <gtk/gtk.h>

extern void goTrayCallback(int id);

static gboolean _gtk_main_quit_idle(gpointer data) {
	gtk_main_quit();
	return G_SOURCE_REMOVE;
}

static void gtk_main_quit_idle(void) {
	g_idle_add(_gtk_main_quit_idle, NULL);
}

static AppIndicator *new_indicator(const char *id, AppIndicatorCategory category) {
	return app_indicator_new(id, "", category);
}

static void indicator_set_icon_with_desc(AppIndicator *ind, const char *path, const char *desc) {
	app_indicator_set_icon_full(ind, path, desc);
}

static void indicator_set_title(AppIndicator *ind, const char *title) {
	app_indicator_set_title(ind, title);
}

static void indicator_set_menu(AppIndicator *ind, GtkMenu *menu) {
	app_indicator_set_menu(ind, menu);
}

static void menu_item_activated(GtkMenuItem *item, gpointer user_data) {
	goTrayCallback(GPOINTER_TO_INT(user_data));
}

static void add_menu_item(GtkMenuShell *shell, const char *label, int callback_id) {
	GtkWidget *item = gtk_menu_item_new_with_label(label);
	g_signal_connect(G_OBJECT(item), "activate", G_CALLBACK(menu_item_activated), GINT_TO_POINTER(callback_id));
	gtk_menu_shell_append(shell, item);
}

static void add_menu_separator(GtkMenuShell *shell) {
	gtk_menu_shell_append(shell, gtk_separator_menu_item_new());
}

static void show_all_menu_ptr(GtkMenu *menu) {
	gtk_widget_show_all(GTK_WIDGET(menu));
}

static GtkMenu *new_gtk_menu() {
	return GTK_MENU(gtk_menu_new());
}

static GtkMenuShell *to_menu_shell(GtkMenu *menu) {
	return GTK_MENU_SHELL(menu);
}
*/
import "C"

type TrayCallbacks interface {
	Quit()
	TrayRun()
	UpdateAvailable(ver string) error
	SetStatus(status string)
	GetIconHandle() int
	GetIconDir() string
}

type AppCallbacks interface {
	UIRun(path string)
	UIShow()
	UITerminate()
	UIRunning() bool
	Quit()
	DoUpdate()
	CheckForUpdates()
}

var (
	callbacks   = map[int]func(){}
	callbackMux sync.Mutex
	callbackIdx int
)

func registerCallback(f func()) int {
	callbackMux.Lock()
	defer callbackMux.Unlock()
	callbackIdx++
	callbacks[callbackIdx] = f
	return callbackIdx
}

//export goTrayCallback
func goTrayCallback(id C.int) {
	callbackMux.Lock()
	f, ok := callbacks[int(id)]
	callbackMux.Unlock()
	if ok {
		f()
	}
}

type Tray struct {
	indicator      *C.AppIndicator
	menu           *C.GtkMenu
	app            AppCallbacks
	iconDir        string
	updateNotified bool
	status         string
	mu             sync.Mutex
}

const (
	trayIconFilename   = "ollama-tray.png"
	updateIconFilename = "ollama-update.png"

	statusRunning         = "running"
	statusUpdateAvailable = "update-available"
	statusUpdating        = "updating"
)

func NewTray(app AppCallbacks) (TrayCallbacks, error) {
	trayIcon, err := assets.GetIcon("ollama-tray.png")
	if err != nil {
		return nil, fmt.Errorf("failed to load tray icon: %w", err)
	}
	updateIcon, err := assets.GetIcon("ollama-update.png")
	if err != nil {
		return nil, fmt.Errorf("failed to load update icon: %w", err)
	}

	iconDir, err := writeIconsToTempDir(trayIcon, updateIcon)
	if err != nil {
		return nil, fmt.Errorf("failed to write icon files: %w", err)
	}

	t := &Tray{
		app:     app,
		iconDir: iconDir,
		status:  statusRunning,
	}

	cid := C.CString("com.ollama.ollama-app")
	t.indicator = C.new_indicator(cid, C.APP_INDICATOR_CATEGORY_APPLICATION_STATUS)
	C.free(unsafe.Pointer(cid))

	if t.indicator == nil {
		return nil, fmt.Errorf("failed to create app indicator (no display server?)")
	}

	C.app_indicator_set_status(t.indicator, C.APP_INDICATOR_STATUS_ACTIVE)

	t.setTitle("Ollama")
	t.setIconFromFile(trayIconFilename, "")

	t.createMenu()

	C.indicator_set_menu(t.indicator, t.menu)

	return t, nil
}

func (t *Tray) createMenu() {
	t.menu = C.new_gtk_menu()
	shell := C.to_menu_shell(t.menu)

	cOpen := C.CString("Open Ollama")
	C.add_menu_item(shell, cOpen,
		C.int(registerCallback(func() { t.app.UIShow() })))
	C.free(unsafe.Pointer(cOpen))

	cSettings := C.CString("Settings...")
	C.add_menu_item(shell, cSettings,
		C.int(registerCallback(func() { t.app.UIRun("/settings") })))
	C.free(unsafe.Pointer(cSettings))

	C.add_menu_separator(shell)

	cCheck := C.CString("Check for Updates...")
	C.add_menu_item(shell, cCheck,
		C.int(registerCallback(func() { t.app.CheckForUpdates() })))
	C.free(unsafe.Pointer(cCheck))

	C.add_menu_separator(shell)

	cQuit := C.CString("Quit Ollama")
	C.add_menu_item(shell, cQuit,
		C.int(registerCallback(func() { t.app.Quit() })))
	C.free(unsafe.Pointer(cQuit))

	C.show_all_menu_ptr(t.menu)
}

func (t *Tray) TrayRun() {}

func (t *Tray) Quit() {
	C.gtk_main_quit_idle()
}

func (t *Tray) setTitle(title string) {
	ctitle := C.CString(title)
	C.indicator_set_title(t.indicator, ctitle)
	C.free(unsafe.Pointer(ctitle))
}

func (t *Tray) setIconFromFile(filename string, desc string) {
	path := filepath.Join(t.iconDir, filename)
	cpath := C.CString(path)
	var cdesc *C.char
	if desc != "" {
		cdesc = C.CString(desc)
	}
	C.indicator_set_icon_with_desc(t.indicator, cpath, cdesc)
	C.free(unsafe.Pointer(cpath))
	if cdesc != nil {
		C.free(unsafe.Pointer(cdesc))
	}
}

func (t *Tray) SetStatus(status string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.status == status {
		return
	}
	t.status = status
	switch status {
	case statusRunning:
		t.setTitle("Ollama")
		t.setIconFromFile(trayIconFilename, "")
	case statusUpdateAvailable:
		t.setTitle("Ollama")
		t.setIconFromFile(updateIconFilename, "Update Available")
	case statusUpdating:
		t.setTitle("Ollama")
		t.setIconFromFile(updateIconFilename, "Updating...")
	}
}

func (t *Tray) UpdateAvailable(ver string) error {
	t.mu.Lock()
	if t.updateNotified {
		t.mu.Unlock()
		return nil
	}
	t.updateNotified = true
	t.mu.Unlock()
	t.SetStatus(statusUpdateAvailable)
	slog.Info("update available notification shown via tray", "version", ver)
	return nil
}

func (t *Tray) GetIconHandle() int {
	return 0
}

func (t *Tray) GetIconDir() string {
	return t.iconDir
}

func writeIconsToTempDir(trayIcon, updateIcon []byte) (string, error) {
	dir := filepath.Join(os.TempDir(), "ollama-tray-icons")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, trayIconFilename), trayIcon, 0o644); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, updateIconFilename), updateIcon, 0o644); err != nil {
		return "", err
	}
	return dir, nil
}
