#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/linux-app"
APPDIR="$BUILD_DIR/Ollama.AppDir"

DIST_DIR="${DIST_DIR:-}"
GOFLAGS="${GOFLAGS:-}"
CGO_CFLAGS="${CGO_CFLAGS:-}"
CGO_CXXFLAGS="${CGO_CXXFLAGS:-}"

echo "=== Building Ollama Linux App ==="
if [ -n "$DIST_DIR" ]; then
    echo "Using pre-built dist directory: $DIST_DIR"
fi

# Step 1: Build React app
echo "--- Building React SPA ---"
cd "$ROOT_DIR/app/ui/app"
npm install
npm run build

# Step 2: Go generate
echo "--- Running go generate ---"
cd "$ROOT_DIR"
go generate ./app/...

# Step 3: Build Go app + ollama CLI
echo "--- Building ollama-app ---"
CGO_ENABLED=1 go build ${GOFLAGS} -o "$APPDIR/usr/bin/ollama-app" ./app/cmd/app

echo "--- Building ollama CLI ---"
CGO_ENABLED=1 go build ${GOFLAGS} -o "$APPDIR/usr/bin/ollama" .

# Step 4: Install llama-server
echo "--- Installing llama-server ---"
mkdir -p "$APPDIR/usr/lib/ollama"
if [ -n "$DIST_DIR" ]; then
    LLAMA_SERVER_SRC="$DIST_DIR/lib/ollama/llama-server"
    if [ ! -f "$LLAMA_SERVER_SRC" ]; then
        echo "ERROR: Pre-built llama-server not found at $LLAMA_SERVER_SRC" >&2
        exit 1
    fi
    cp "$LLAMA_SERVER_SRC" "$APPDIR/usr/lib/ollama/llama-server"
    chmod +x "$APPDIR/usr/lib/ollama/llama-server"

    # Copy any shared runtime libraries (CUDA, ROCm, Vulkan, etc.)
    if [ -d "$DIST_DIR/lib/ollama" ]; then
        for f in "$DIST_DIR/lib/ollama/"*; do
            base="$(basename "$f")"
            case "$base" in
                llama-server) ;; # already copied
                *) cp -a "$f" "$APPDIR/usr/lib/ollama/" ;;
            esac
        done
    fi
else
    echo "WARNING: DIST_DIR not set; building llama-server locally" >&2
    echo "  For release builds, set DIST_DIR=dist/linux-amd64 to use pre-built artifacts" >&2
    CGO_ENABLED=1 go build ${GOFLAGS} -o "$APPDIR/usr/lib/ollama/llama-server" ./cmd/llama-server
fi

# Step 5: Create AppDir structure
echo "--- Creating AppDir structure ---"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/lib/ollama"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/22x22/apps"

# Copy .desktop file
cp "$ROOT_DIR/app/linux/com.ollama.Ollama.desktop" "$APPDIR/usr/share/applications/"

# Copy icons
cp "$ROOT_DIR/app/assets/ollama.png" "$APPDIR/usr/share/icons/hicolor/256x256/apps/ollama.png"
cp "$ROOT_DIR/app/assets/ollama-tray.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-tray.png"
cp "$ROOT_DIR/app/assets/ollama-tray-dark.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-tray-dark.png"
cp "$ROOT_DIR/app/assets/ollama-update.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-update.png"
cp "$ROOT_DIR/app/assets/ollama-update-dark.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-update-dark.png"

# Create AppRun
cat > "$APPDIR/AppRun" << 'APPRUN'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
export XDG_DATA_DIRS="${HERE}/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export XDG_CACHE_HOME="${HERE}/usr/cache:${XDG_CACHE_HOME:-${HOME}/.cache}"
export GDK_BACKEND="${GDK_BACKEND:-x11}"
exec "${HERE}/usr/bin/ollama-app" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

# Copy .desktop to AppDir root
cp "$APPDIR/usr/share/applications/com.ollama.Ollama.desktop" "$APPDIR/"

# Copy icon to AppDir root
cp "$ROOT_DIR/app/assets/ollama.png" "$APPDIR/"

# Step 6: Create AppImage (if appimagetool is available)
if command -v appimagetool &>/dev/null; then
    echo "--- Creating AppImage ---"
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) ARCH="amd64" ;;
        aarch64|arm64) ARCH="arm64" ;;
    esac
    appimagetool "$APPDIR" "$BUILD_DIR/ollama-linux-${ARCH}.AppImage"
    echo "=== AppImage created: $BUILD_DIR/ollama-linux-${ARCH}.AppImage ==="
else
    echo "=== appimagetool not found. AppDir created at $APPDIR ==="
    echo "=== Install appimagetool to create an AppImage: ==="
    echo "    wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage -O /usr/local/bin/appimagetool"
    echo "    chmod +x /usr/local/bin/appimagetool"
fi