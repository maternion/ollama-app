# Ollama Linux Desktop App

Fork of [ollama/ollama](https://github.com/ollama/ollama) with Linux desktop app support.

- **GitHub**: https://github.com/maternion/ollama-app
- **Branch**: `linux-desktop-app` (default branch, merges from upstream `main`)
- **Module**: `github.com/ollama/ollama` (Go 1.26.0)
- **Versioning**: Follows upstream ollama versions

## Build & Dev Commands

```bash
# Frontend dev (Vite + React)
cd app/ui/app && npm run dev

# Frontend build (tsc + vite build)
cd app/ui/app && npm run build

# Frontend lint/test
cd app/ui/app && npm run lint && npm test

# Go generate (regenerates app/ui/app/codegen/gotypes.gen.ts from Go structs)
go generate ./app/ui/

# Quick Go app binary (fast iteration, no AppImage)
CGO_ENABLED=1 go build -o /tmp/ollama-app ./app/cmd/app

# Full AppImage build (requires GTK deps)
./scripts/build_linux_app.sh

# Formatted all Go files before pushing (CI will fail otherwise)
gofmt -w .
```

## Architecture

- **Go + native webview + React SPA** (same as macOS/Windows)
- **GTK3 + WebKitGTK** for the webview (via vendored `webview.h` with `WEBVIEW_GTK` backend)
- **libayatana-appindicator3** for system tray (raw CGo, not gotk3)
- **All GTK calls from background goroutines use `g_idle_add`** for thread safety
- **Linux: thin GUI frontend for systemd ollama service** — never starts managed server
  - Settings changes written to `/etc/systemd/system/ollama.service.d/app.conf` via `pkexec`
  - Service restarted via `pkexec systemctl daemon-reload && systemctl restart ollama`
- **macOS/Windows**: maintain upstream managed server behavior

## Frontend Structure

```
app/ui/app/src/
├── api.ts                          # API client (fetch wrappers + ollama/browser SDK)
├── codegen/gotypes.gen.ts          # Generated TypeScript types (from Go structs)
├── components/
│   ├── Chat.tsx                    # Main chat component
│   ├── ChatForm.tsx                # Message input form
│   ├── ChatSidebar.tsx             # Chat list sidebar
│   ├── MessageList.tsx             # Message list container
│   ├── Message.tsx                 # Message display
│   ├── WebSearchButton.tsx         # Tool button pattern (model for VoiceButton)
│   ├── ThinkButton.tsx             # Tool button pattern
│   ├── Settings.tsx                # Settings panel
│   └── layout/layout.tsx           # SidebarLayout
├── hooks/
│   ├── useChats.ts                 # Chat CRUD + sendMessage mutation
│   ├── useModelCapabilities.ts     # useHasVisionCapability, useHasToolsCapability
│   ├── useModels.ts
│   ├── useSelectedModel.ts
│   └── useSettings.ts
├── routes/
│   ├── __root.tsx                  # TanStack Router root
│   ├── c.$chatId.tsx               # Chat route
│   └── index.tsx                   # Home route
└── types/webview.d.ts              # Webview interop types
```

## Model Capabilities System

Front-to-back flow:

1. **Go**: `types/model/capability.go` defines `CapabilityAudio = Capability("audio")` and others
2. **Go**: `server/images.go` detects capabilities from GGUF metadata (`audio.block_count`), projector files (`has_audio_encoder`), model family overrides. Audio suppressed for Nemotron3 and small Gemma4 variants.
3. **Go**: `/api/show` returns `Capabilities: m.Capabilities()` in `ShowResponse`
4. **Frontend**: `api.ts` → `ollama.show({ model })` → `getModelCapabilities(modelName)`
5. **Frontend**: `useModelCapabilities.ts` → `useHasVisionCapability`, `useHasToolsCapability` (add `useHasAudioCapability` the same way)

### Adding a new capability-based feature:

```typescript
// In useModelCapabilities.ts:
export function useHasAudioCapability(modelName: string | undefined) {
  const { data } = useModelCapabilities(modelName);
  return data?.capabilities?.includes("audio") ?? false;
}
```

## Audio/Voice Input Support

**Current state**: Backend supports audio — `CapabilityAudio` defined, OpenAI-compatible `POST /v1/audio/transcriptions` exists, Gemma4 audio encoder in `model/models/gemma4/model_audio.go` + `process_audio.go`. No frontend voice UI exists.

**Architecture for adding voice input**:
- **Frontend**: Use Web Speech API (`SpeechRecognition`) in a new `VoiceButton.tsx` component (modeled after `WebSearchButton.tsx`)
- **Send audio**: Convert speech-to-text result, or send audio blob as `input_audio` content part. The Go `api.Message.Images []ImageData` field accepts raw byte blobs (currently used for images, also carries audio in the existing OpenAI transcription flow).
- **Backend**: `openai/openai.go` `FromTranscriptionRequest()` wraps audio as a chat message with audio as `Images` attachment. Native chat API (`POST /api/chat`) needs `input_audio` handling in `server/routes.go` `ChatHandler`.

**Key files for audio support**:
| File | Purpose |
|------|---------|
| `types/model/capability.go` | `CapabilityAudio` constant |
| `server/images.go` | Audio capability detection from GGUF |
| `openai/openai.go` | `TranscriptionRequest`, `FromTranscriptionRequest` |
| `model/models/gemma4/model_audio.go` | Gemma4 audio encoder |
| `model/models/gemma4/process_audio.go` | WAV processing (16kHz, mel spectrogram) |
| `server/routes.go` | `ChatHandler` — add `input_audio` content part handling |

## Codegen (Critical!)

`app/ui/app/codegen/gotypes.gen.ts` is **generated**. Run after adding/removing fields in Go structs:
```bash
go generate ./app/ui/
```
The `//go:generate` directive is in `app/ui/ui.go:40`. If you add a field to a Go struct that's consumed by the frontend, regenerate before committing.

## Key Files

| File | Purpose |
|------|---------|
| `app/cmd/app/app_linux.go` | Linux platform entry point (GTK init, tray, SIGUSR2 URL scheme) |
| `app/linuxtray/tray.go` | System tray via libayatana-appindicator3 CGo (thread-safe idle callbacks) |
| `app/dialog/dlgs_linux.go` | GTK3 native dialogs (CGo wrappers) |
| `app/webview/webview.h` | WebKitGTK `create` signal handler for `window.open` |
| `app/webview/webview.go` | Linux CGo flags with pkg-config |
| `app/updater/updater_linux.go` | Stub updater (no auto-update on Linux) |
| `app/server/server_linux.go` | Linux stub: `IsServerRunning`, `GetInferenceInfo` only |
| `app/store/store_linux.go` | Systemd helpers: `ReadSystemdServiceEnv`, `WriteSystemdDropIn`, `RestartSystemdService` |
| `app/cmd/app/app_linux_server.go` | Linux server startup: no managed server, pkexec-based restart |
| `app/ui/ui.go` | Go codegen directive + frontend SPA embedding, `//go:generate tscriptify...` |
| `app/ui/app/codegen/gotypes.gen.ts` | Generated TypeScript types from Go structs |
| `app/ui/app/src/api.ts` | Frontend API client |
| `app/ui/app/src/hooks/useModelCapabilities.ts` | Capabilities hooks (vision, tools, add audio) |
| `app/ui/app/src/hooks/useChats.ts` | `sendMessage` mutation, streaming context |
| `scripts/build_linux_app.sh` | AppImage build script (DIST_DIR, ldflags) |
| `scripts/install.sh` | Install script (CLI from upstream ollama, AppImage from fork) |

## Known Issues

- **Context length slider disabled** on Linux (app connects to systemd service, can't read inference log). Always disabled.
- **`llama-server` not bundled** in local builds unless `DIST_DIR` is set. AppImage falls back to system PATH.

## Build Tags Convention

- `//go:build linux` — Linux-only platform files
- `//go:build windows` — Windows-only
- `//go:build darwin` — macOS-only
- `//go:build darwin || linux` — Unix-shared
- `//go:build windows || darwin` — Download-focused updater tests, managed server

## CI Workflows

| Workflow | Purpose |
|----------|---------|
| `test.yaml` | PR checks: build, test, lint on ubuntu/macos/windows |
| `test-install.yaml` | Tests install.sh on ubuntu/macos |
| `release.yaml` | Builds and uploads AppImage on tags |

## Backlog Features

### `?q=` URL query auto-send

Allow users to visit `http://localhost:PORT/?q=question+here` to open a new chat and auto-send a message.

**Pattern from llama.cpp**: `tools/ui/src/routes/(chat)/chat/[id]/+page.svelte` reads `$derived(page.url.searchParams.get('q'))`, auto-sends in an `$effect`, then clears the URL param via `replaceState`.

**Implementation approach** (not currently active):
1. `routes/index.tsx`: `beforeLoad` detects `?q=` from `window.location.search`. If present, returns early (no redirect). Add an `Index` component that uses `useNavigate` to call `navigate({ to: "/c/$chatId", params: { chatId: "new" }, search: { q } })`.
2. `routes/c.$chatId.tsx`: Add `validateSearch` to extract `q`, pass it to `<Chat>` as prop.
3. `components/Chat.tsx`: Accept `q` prop. In a `useEffect`, if `q` is set and `selectedModel?.model` is loaded, call `sendMessageMutation.mutate({ message: q, ... })`. Clear `?q=` from the URL after sending via `navigate({ search: { q: undefined }, replace: true })` to prevent re-send on refresh.
4. `hooks/useChats.ts`: The navigation fix (`router.navigate` to `/c/{newId}` after stream completes when starting from `chatId="new"`) is a separate fix and should remain active.

**Gotchas**:
- `redirect({ search: { q } })` from `beforeLoad` does NOT actually set search params in the URL in TanStack Router v1 — use `useNavigate` from a component instead.
- `redirect({ search })` without `mask` loses the search param. The mask `{ to: "/" }` also strips it.
- SessionStorage approach (setting in `beforeLoad`, reading in Chat) doesn't work — timing issue with when Chat mounts vs redirect completes.

| Workflow | Purpose |
|----------|---------|
| `test.yaml` | PR checks: build, test, lint on ubuntu/macos/windows |
| `test-install.yaml` | Tests install.sh on ubuntu/macos |
| `release.yaml` | Builds and uploads AppImage on tags |

## Creating a Release

When upstream [ollama/ollama](https://github.com/ollama/ollama) publishes a new `v0.X.Y`, merge into our fork:

```bash
# 1. Fetch upstream tag
git fetch origin --tags

# 2. Check divergence
git log --oneline linux-desktop-app..v0.X.Y --count   # upstream commits we lack
git log --oneline v0.X.Y..linux-desktop-app --count    # our commits not upstream
git diff --name-only $(git merge-base linux-desktop-app v0.X.Y) linux-desktop-app \
  | grep -v '^dist/\|\.AppImage\|\.gitignore\|opencode\.json\|\.githooks/\|\.github/'  # our actual code changes

# 3. Merge upstream tag
git merge v0.X.Y
# High-conflict files: app/ui/ui.go, app/updater/updater.go, app/cmd/app/app.go
# Our fork-only files never conflict: tray, systemd, notify, store_linux, server_linux, etc.

# 4. Build AppImage
VERSION=v0.X.Y-linux bash scripts/build_linux_app.sh

# 5. Tag and release
VERSION=v0.X.Y-linux bash scripts/build_linux_app.sh
# Case A: No new app features since last release — simple release notes
# Case B: New app features merged — include changelog of what we added
gh release create v0.X.Y --repo maternion/ollama-app \
  --title "v0.X.Y" \
  --notes "Based on upstream [ollama v0.X.Y](https://github.com/ollama/ollama/releases/tag/v0.X.Y)." \
  dist/linux-app/ollama-linux-amd64.AppImage
```