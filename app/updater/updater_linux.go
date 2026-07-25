//go:build linux

package updater

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

func init() {
	appDataDir := filepath.Join(os.Getenv("HOME"), ".ollama")
	UpdateStageDir = filepath.Join(appDataDir, "updates")
	UpgradeMarkerFile = filepath.Join(appDataDir, "upgraded")
	UpgradeLogFile = filepath.Join(appDataDir, "logs", "upgrade.log")

	var sysname unix.Utsname
	if err := unix.Uname(&sysname); err == nil {
		sn := bytesToString(sysname.Sysname[:])
		rel := bytesToString(sysname.Release[:])
		if sn != "" {
			UserAgentOS = fmt.Sprintf("%s/%s", sn, rel)
		}
	}
	if UserAgentOS == "" {
		UserAgentOS = "Linux"
	}

	VerifyDownload = verifyDownload
}

func bytesToString(b []byte) string {
	var i int
	for i = range b {
		if b[i] == 0 {
			break
		}
	}
	return string(b[:i])
}

func verifyDownload() error {
	slog.Debug("download verification not supported on Linux")
	return nil
}

func DoUpgrade(interactive bool) error {
	slog.Info("auto-update not supported on Linux")
	return fmt.Errorf("auto-update not supported on Linux")
}

func DoUpgradeAtStartup() error {
	slog.Info("auto-update not supported on Linux")
	return fmt.Errorf("auto-update not supported on Linux")
}

func DoPostUpgradeCleanup() error {
	return nil
}

func IsUpdatePending() bool {
	return false
}
