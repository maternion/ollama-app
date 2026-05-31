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

static AppIndicator *new_indicator(const char *id, const char *icon_name, const char *icon_path) {
	AppIndicator *ind = app_indicator_new(id, icon_name, APP_INDICATOR_CATEGORY_APPLICATION_STATUS);
	if (icon_path && icon_path[0] != '\0') {
		app_indicator_set_icon_theme_path(ind, icon_path);
	}
	app_indicator_set_status(ind, APP_INDICATOR_STATUS_ACTIVE);
	return ind;
}

static void indicator_set_icon(AppIndicator *ind, const char *icon_name) {
	app_indicator_set_icon_full(ind, icon_name, icon_name);
}

static void indicator_set_attention_icon(AppIndicator *ind, const char *icon_name) {
	app_indicator_set_attention_icon_full(ind, icon_name, icon_name);
}

static void indicator_set_status_attention(AppIndicator *ind) {
	app_indicator_set_status(ind, APP_INDICATOR_STATUS_ATTENTION);
}

static void indicator_set_status_active(AppIndicator *ind) {
	app_indicator_set_status(ind, APP_INDICATOR_STATUS_ACTIVE);
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

static void show_all_menu(GtkWidget *menu) {
	gtk_widget_show_all(menu);
}

static GtkMenu *new_gtk_menu() {
	return GTK_MENU(gtk_menu_new());
}

static GtkMenuShell *to_menu_shell(GtkMenu *menu) {
	return GTK_MENU_SHELL(menu);
}

static void show_all_menu_ptr(GtkMenu *menu) {
	gtk_widget_show_all(GTK_WIDGET(menu));
}
*/
import "C"

type TrayCallbacks interface {
	Quit()
	TrayRun()
	UpdateAvailable(ver string) error
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
	menu          *C.GtkMenu
	app           AppCallbacks
	iconDir       string
	updateNotified bool
	mu            sync.Mutex
}

const (
	trayIconName   = "ollama-tray"
	updateIconName = "ollama-update"
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
	}

	cid := C.CString("com.ollama.ollama-app")
	cIconName := C.CString(trayIconName)
	cIconPath := C.CString(iconDir)
	t.indicator = C.new_indicator(cid, cIconName, cIconPath)
	C.free(unsafe.Pointer(cid))
	C.free(unsafe.Pointer(cIconName))
	C.free(unsafe.Pointer(cIconPath))

	ctitle := C.CString("Ollama")
	C.indicator_set_title(t.indicator, ctitle)
	C.free(unsafe.Pointer(ctitle))

	cAttIcon := C.CString(updateIconName)
	C.indicator_set_attention_icon(t.indicator, cAttIcon)
	C.free(unsafe.Pointer(cAttIcon))

	t.createMenu()

	C.indicator_set_menu(t.indicator, t.menu)

	return t, nil
}

func (t *Tray) createMenu() {
	t.menu = C.new_gtk_menu()
	shell := C.to_menu_shell(t.menu)

	C.add_menu_item(shell, C.CString("Open Ollama"),
		C.int(registerCallback(func() { t.app.UIShow() })))

	C.add_menu_item(shell, C.CString("Settings..."),
		C.int(registerCallback(func() { t.app.UIRun("/settings") })))

	C.add_menu_separator(shell)

	C.add_menu_item(shell, C.CString("Quit Ollama"),
		C.int(registerCallback(func() { t.app.Quit() })))

	C.show_all_menu_ptr(t.menu)
}

func (t *Tray) TrayRun() {}

func (t *Tray) Quit() {
	C.gtk_main_quit()
}

func (t *Tray) UpdateAvailable(ver string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.updateNotified {
		return nil
	}
	t.updateNotified = true
	C.indicator_set_status_attention(t.indicator)
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
	if err := os.WriteFile(filepath.Join(dir, trayIconName+".png"), trayIcon, 0o644); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, updateIconName+".png"), updateIcon, 0o644); err != nil {
		return "", err
	}
	return dir, nil
}