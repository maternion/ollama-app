//go:build linux

package store

import (
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
)

func init() {
	systemdServiceModelsDir = func() string {
		return ReadSystemdServiceEnv("OLLAMA_MODELS")
	}
	restartService = RestartSystemdService
}

const (
	systemdDropInDir  = "/etc/systemd/system/ollama.service.d"
	systemdDropInFile = systemdDropInDir + "/app.conf"
)

// ReadSystemdServiceEnv reads an environment variable from the ollama systemd service (running or not).
func ReadSystemdServiceEnv(key string) string {
	env := ReadAllSystemdServiceEnv()
	return env[key]
}

// ReadAllSystemdServiceEnv returns all environment variables from the ollama systemd service.
func ReadAllSystemdServiceEnv() map[string]string {
	env := make(map[string]string)
	out, err := exec.Command(
		"/usr/bin/systemctl",
		"show", "ollama.service",
		"--property=Environment",
		"--value",
	).Output()
	if err != nil {
		slog.Debug("failed to read systemd service env", "error", err)
		return env
	}
	// Parse line by line, respecting quoted values
	s := string(out)
	for len(s) > 0 {
		s = strings.TrimLeft(s, " \t\n")
		if s == "" {
			break
		}
		eqPos := strings.IndexByte(s, '=')
		if eqPos < 0 {
			break
		}
		key := s[:eqPos]
		s = s[eqPos+1:]
		if s == "" {
			env[key] = ""
			continue
		}
		if s[0] == '"' {
			// Quoted value: find closing quote
			s = s[1:]
			end := strings.IndexByte(s, '"')
			if end < 0 {
				env[key] = s
				break
			}
			env[key] = unescapeSystemdValue(s[:end])
			s = s[end+1:]
		} else {
			// Unquoted: consume until whitespace
			end := strings.IndexAny(s, " \t\n")
			if end < 0 {
				env[key] = s
				break
			}
			env[key] = s[:end]
			s = s[end:]
		}
	}
	return env
}

func escapeSystemdValue(v string) string {
	v = strings.ReplaceAll(v, "\\", "\\\\")
	v = strings.ReplaceAll(v, "\"", "\\\"")
	v = strings.ReplaceAll(v, "$", "$$")
	return "\"" + v + "\""
}

func unescapeSystemdValue(v string) string {
	v = strings.ReplaceAll(v, "$$", "$")
	v = strings.ReplaceAll(v, "\\\"", "\"")
	v = strings.ReplaceAll(v, "\\\\", "\\")
	return v
}

// IsSystemdServiceActive returns true if the ollama systemd service is active (running).
func IsSystemdServiceActive() bool {
	err := exec.Command("/usr/bin/systemctl", "is-active", "--quiet", "ollama.service").Run()
	return err == nil
}

// EnsureSystemdServiceRunning kills any rogue ollama processes and starts the systemd service via pkexec.
// Returns true if the service is running after the attempt.
func EnsureSystemdServiceRunning() bool {
	if IsSystemdServiceActive() {
		slog.Info("ollama systemd service is already active")
		return true
	}
	slog.Warn("ollama systemd service not active; attempting to start via pkexec")
	cmd := exec.Command(
		"/usr/bin/pkexec",
		"/usr/bin/sh", "-c",
		"/usr/bin/systemctl kill --signal=SIGTERM ollama.service 2>/dev/null; "+
			"/usr/bin/pkill -x ollama 2>/dev/null; "+
			"/usr/bin/systemctl start ollama; "+
			"/usr/bin/systemctl is-active --quiet ollama.service",
	)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		slog.Warn("failed to ensure systemd service is running", "error", err)
		return false
	}
	slog.Info("ollama systemd service started")
	return true
}

// WriteSystemdDropIn writes a systemd drop-in file with Environment= lines
// for the given env vars, then reloads and restarts the service via pkexec.
func WriteSystemdDropIn(env map[string]string) error {
	var buf bytes.Buffer
	buf.WriteString("[Service]\n")
	for k, v := range env {
		if v != "" {
			buf.WriteString(fmt.Sprintf("Environment=%s=%s\n", k, escapeSystemdValue(v)))
		}
	}
	content := buf.String()

	// Write to a temp file first, then copy via pkexec to avoid heredoc quoting issues
	tmpFile, err := os.CreateTemp("", "ollama-dropin-*.conf")
	if err != nil {
		return fmt.Errorf("create temp drop-in: %w", err)
	}
	tmpPath := tmpFile.Name()
	if _, err := tmpFile.WriteString(content); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("write temp drop-in: %w", err)
	}
	tmpFile.Close()
	defer os.Remove(tmpPath)

	cmd := exec.Command(
		"/usr/bin/pkexec",
		"/usr/bin/sh", "-c",
		fmt.Sprintf(
			"mkdir -p %s && cp %s %s && /usr/bin/systemctl daemon-reload && /usr/bin/systemctl restart ollama",
			systemdDropInDir, tmpPath, systemdDropInFile,
		),
	)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply systemd drop-in: %w", err)
	}
	slog.Info("systemd drop-in applied and service restarted", "file", systemdDropInFile)
	return nil
}

// RestartSystemdService restarts the ollama systemd service via pkexec.
func RestartSystemdService() error {
	cmd := exec.Command(
		"/usr/bin/pkexec",
		"/usr/bin/sh", "-c",
		"/usr/bin/systemctl daemon-reload && /usr/bin/systemctl restart ollama",
	)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to restart systemd service: %w", err)
	}
	slog.Info("systemd ollama service restarted")
	return nil
}
