//go:build linux

package main

/*
#cgo pkg-config: gtk+-3.0
#include <gtk/gtk.h>

static void set_window_icon_from_file(void *window_ptr, const char *icon_path) {
	GtkWindow *window = GTK_WINDOW(window_ptr);
	gtk_window_set_icon_from_file(window, icon_path, NULL);
}

static void show_gtk_window(void *ptr) {
	GtkWidget *w = GTK_WIDGET(ptr);
	gtk_widget_show_all(w);
	gtk_window_present(GTK_WINDOW(w));
}

static void hide_gtk_window(void *ptr) {
	GtkWidget *w = GTK_WIDGET(ptr);
	gtk_widget_hide(w);
}

static gboolean _show_idle_cb(gpointer data) {
	show_gtk_window(data);
	return G_SOURCE_REMOVE;
}

static void show_gtk_window_idle(void *ptr) {
	g_idle_add(_show_idle_cb, ptr);
}
*/
import "C"

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"unsafe"

	"github.com/ollama/ollama/app/linuxtray"
	"github.com/ollama/ollama/app/updater"
	"github.com/ollama/ollama/app/version"
)

var (
	appLogPath = filepath.Join(os.Getenv("HOME"), ".ollama", "logs", "app.log")
	appPath    string
	ollamaPath string
	tray       linuxtray.TrayCallbacks
)

type appCallbacks struct {
	shutdown func()
}

var app = &appCallbacks{}

func init() {
	exe, err := os.Executable()
	if err != nil {
		slog.Warn("error discovering executable directory", "error", err)
	} else {
		appPath = filepath.Dir(exe)
	}
	ollamaPath = filepath.Join(appPath, "ollama")

	if _, err := os.Stat(ollamaPath); err != nil {
		pwd, err := os.Getwd()
		if err != nil {
			slog.Warn("missing ollama and failed to get pwd", "error", err)
			return
		}
		distAppPath := filepath.Join(pwd, "dist", "linux-"+runtime.GOARCH)
		distOllamaPath := filepath.Join(distAppPath, "ollama")
		if _, err := os.Stat(distOllamaPath); err == nil {
			slog.Info("detected developer mode")
			appPath = distAppPath
			ollamaPath = distOllamaPath
		}
	}
}

func (ac *appCallbacks) UIRun(path string) {
	wv.Run(path)
}

func (*appCallbacks) UIShow() {
	if wv.webview != nil {
		showWindow(wv.webview.Window())
	} else {
		wv.Run("/")
	}
}

func (*appCallbacks) UITerminate() {
	wv.Terminate()
}

func (*appCallbacks) UIRunning() bool {
	return wv.IsRunning()
}

func (ac *appCallbacks) Quit() {
	ac.shutdown()
}

func (*appCallbacks) DoUpdate() {
	slog.Info("auto-update not supported on Linux, opening browser")
	openInBrowser("https://ollama.com/download")
}

func maybeMoveAndRestart() appMove {
	return CannotMove
}

func handleExistingInstance(startHidden bool) {
	lockDir := os.Getenv("XDG_RUNTIME_DIR")
	if lockDir == "" {
		lockDir = filepath.Join(os.TempDir(), fmt.Sprintf("ollama-%d", os.Getuid()))
	}
	lockFile := filepath.Join(lockDir, "ollama.lock")

	data, err := os.ReadFile(lockFile)
	if err == nil {
		var pid int
		if _, err := fmt.Sscanf(string(data), "%d", &pid); err == nil && pid > 0 {
			if proc, err := os.FindProcess(pid); err == nil && proc.Signal(syscall.Signal(0)) == nil {
				if ollamaPidRunning(pid) {
					slog.Info("existing instance found, exiting", "pid", pid)
					os.Exit(0)
				}
			}
		}
	}

	os.Remove(lockFile)
	os.MkdirAll(lockDir, 0o700)
	if err := os.WriteFile(lockFile, []byte(fmt.Sprintf("%d", os.Getpid())), 0o600); err != nil {
		slog.Warn("failed to write lock file", "error", err)
	}
}

func ollamaPidRunning(pid int) bool {
	output, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "comm=").Output()
	if err != nil {
		return false
	}
	comm := strings.TrimSpace(string(output))
	// The running process could be "ollama-app", "Ollama" (AppImage runtime),
	// or have a path prefix. Check the base name.
	return comm != "" && strings.Contains(comm, "ollama")
}

func installSymlink() {}

func UpdateAvailable(ver string) error {
	if tray != nil {
		return tray.UpdateAvailable(ver)
	}
	return nil
}

func osRun(shutdown func(), hasCompletedFirstRun, startHidden bool) {
	app.shutdown = shutdown

	C.gtk_init(nil, nil)

	var err error
	tray, err = linuxtray.NewTray(app)
	if err != nil {
		slog.Error("failed to create system tray", "error", err)
	}

	if updater.IsUpdatePending() {
		slog.Debug("update pending on startup, showing tray notification")
		UpdateAvailable("")
	}

	if !hasCompletedFirstRun {
		installAutostart()
		installDesktopEntry()
	}

	if startHidden {
		startHiddenTasks()
	}

	usr2Signals := make(chan os.Signal, 1)
	signal.Notify(usr2Signals, syscall.SIGUSR2)
	go func() {
		for sig := range usr2Signals {
			switch sig {
			case syscall.SIGUSR2:
				lockDir := os.Getenv("XDG_RUNTIME_DIR")
				if lockDir == "" {
					lockDir = filepath.Join(os.TempDir(), fmt.Sprintf("ollama-%d", os.Getuid()))
				}
				urlFile := filepath.Join(lockDir, "ollama-url-scheme")
				data, err := os.ReadFile(urlFile)
				if err != nil {
					slog.Warn("received SIGUSR1 but failed to read URL scheme file", "error", err)
					continue
				}
				os.Remove(urlFile)
				urlScheme := strings.TrimSpace(string(data))
				if urlScheme != "" {
					slog.Info("handling forwarded URL scheme", "url", urlScheme)
					go handleURLSchemeInCurrentInstance(urlScheme)
				}
			}
		}
	}()

	if !startHidden {
		ptr := wv.Run("/")
		if ptr != nil && tray != nil {
			iconDir := tray.GetIconDir()
			if iconDir != "" {
				iconPath := filepath.Join(iconDir, "ollama-tray.png")
				cIconPath := C.CString(iconPath)
				C.set_window_icon_from_file(ptr, cIconPath)
				C.free(unsafe.Pointer(cIconPath))
			}
		}
	}
	C.gtk_main()
}

func installAutostart() {
	autostartDir := filepath.Join(os.Getenv("HOME"), ".config", "autostart")
	autostartFile := filepath.Join(autostartDir, "ollama.desktop")

	if _, err := os.Stat(autostartFile); err == nil {
		slog.Debug("autostart already exists", "path", autostartFile)
		return
	}

	exe, err := os.Executable()
	if err != nil {
		slog.Warn("unable to get executable path for autostart", "error", err)
		return
	}

	desktopEntry := fmt.Sprintf("[Desktop Entry]\nType=Application\nName=Ollama\nComment=Run large language models locally\nExec=%s hidden\nIcon=ollama\nTerminal=false\nCategories=Development;AI;\nMimeType=x-scheme-handler/ollama;\nStartupWMClass=ollama\n", exe)

	if err := os.MkdirAll(autostartDir, 0o755); err != nil {
		slog.Warn("unable to create autostart directory", "error", err)
		return
	}

	if err := os.WriteFile(autostartFile, []byte(desktopEntry), 0o644); err != nil {
		slog.Warn("unable to write autostart file", "error", err)
		return
	}

	slog.Info("installed autostart entry", "path", autostartFile)
}

func installDesktopEntry() {
	appDir := filepath.Join(os.Getenv("HOME"), ".local", "share", "applications")
	appFile := filepath.Join(appDir, "com.ollama.Ollama.desktop")

	exe, err := os.Executable()
	if err != nil {
		slog.Warn("unable to get executable path for desktop entry", "error", err)
		return
	}

	installed := false
	if data, err := os.ReadFile(appFile); err == nil {
		if strings.Contains(string(data), exe) {
			installed = true
		}
	}

	if !installed {
		if err := os.MkdirAll(appDir, 0o755); err != nil {
			slog.Warn("unable to create applications directory", "error", err)
			return
		}

		desktopEntry := fmt.Sprintf(
			"[Desktop Entry]\nType=Application\nName=Ollama\nComment=Run large language models locally\nExec=%s %%U\nIcon=ollama\nTerminal=false\nCategories=Development;AI;\nMimeType=x-scheme-handler/ollama;\nStartupNotify=true\nStartupWMClass=ollama\n",
			exe,
		)

		if err := os.WriteFile(appFile, []byte(desktopEntry), 0o644); err != nil {
			slog.Warn("unable to write desktop entry", "error", err)
			return
		}
		slog.Info("installed desktop entry", "path", appFile)
	}

	if path, err := exec.LookPath("xdg-mime"); err == nil {
		cmd := exec.Command(path, "default", "com.ollama.Ollama.desktop", "x-scheme-handler/ollama")
		if err := cmd.Run(); err != nil {
			slog.Warn("failed to register ollama:// URL scheme handler", "error", err)
		}
	}

	if path, err := exec.LookPath("update-desktop-database"); err == nil {
		cmd := exec.Command(path, appDir)
		cmd.Run()
	}
}

func quit() {
	C.gtk_main_quit()
}

func LaunchNewApp() {}

func logStartup() {
	slog.Info("starting Ollama", "app", appPath, "version", version.Version, "OS", updater.UserAgentOS)
}

func showWindow(ptr unsafe.Pointer) {
	if ptr == nil {
		return
	}
	C.show_gtk_window_idle(ptr)
}

func hideWindow(ptr unsafe.Pointer) {
	if ptr == nil {
		return
	}
	C.hide_gtk_window(ptr)
}

func runInBackground() {
	exe, err := os.Executable()
	if err != nil {
		slog.Error("failed to get executable path", "error", err)
		os.Exit(1)
	}
	cmd := exec.Command(exe, "hidden")
	if err := cmd.Run(); err != nil {
		slog.Error("failed to run Ollama in background", "exe", exe, "error", err)
		os.Exit(1)
	}
}

func drag(ptr unsafe.Pointer) {}

func doubleClick(ptr unsafe.Pointer) {}

func checkAndHandleExistingInstance(urlSchemeRequest string) bool {
	if urlSchemeRequest == "" {
		return false
	}

	lockDir := os.Getenv("XDG_RUNTIME_DIR")
	if lockDir == "" {
		lockDir = filepath.Join(os.TempDir(), fmt.Sprintf("ollama-%d", os.Getuid()))
	}
	lockFile := filepath.Join(lockDir, "ollama.lock")

	data, err := os.ReadFile(lockFile)
	if err != nil {
		return false
	}

	var pid int
	if _, err := fmt.Sscanf(string(data), "%d", &pid); err != nil || pid <= 0 {
		return false
	}

	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	if err := proc.Signal(syscall.Signal(0)); err != nil {
		return false
	}

	urlFile := filepath.Join(lockDir, "ollama-url-scheme")
	if err := os.WriteFile(urlFile, []byte(urlSchemeRequest), 0o600); err != nil {
		slog.Warn("failed to write URL scheme file for existing instance", "error", err)
		return false
	}

	if err := proc.Signal(syscall.SIGUSR2); err != nil {
		slog.Warn("failed to signal existing instance", "pid", pid, "error", err)
		return false
	}

	slog.Info("forwarded URL scheme to existing instance", "pid", pid, "url", urlSchemeRequest)
	os.Exit(0)
	return true
}