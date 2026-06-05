#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/linux-app"
APPDIR="$BUILD_DIR/Ollama.AppDir"

# Check for libnotify-dev (needed for desktop notifications)
if ! pkg-config --exists libnotify 2>/dev/null; then
    echo "WARNING: libnotify development headers not found." >&2
    echo "  Install with: sudo apt-get install libnotify-dev" >&2
    echo "  Notifications will be disabled in the build." >&2
fi

DIST_DIR="${DIST_DIR:-}"
GOFLAGS="${GOFLAGS:-}"
CGO_CFLAGS="${CGO_CFLAGS:-}"
CGO_CXXFLAGS="${CGO_CXXFLAGS:-}"

VERSION="${VERSION:-$(git describe --tags --always 2>/dev/null || echo '0.0.0')}"
LDFLAGS="-X github.com/ollama/ollama/version.Version=${VERSION} -X github.com/ollama/ollama/app/version.Version=${VERSION}"

# Path to linuxdeploy (auto-bundles shared libs)
LINUXDEPLOY="${LINUXDEPLOY:-$(command -v linuxdeploy || echo ~/.local/bin/linuxdeploy)}"
LINGPU="${LINUXDEPLOY_GTK_PLUGIN:-$(command -v linuxdeploy-plugin-gtk.sh || echo ~/.local/bin/linuxdeploy-plugin-gtk.sh)}"

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
CGO_ENABLED=1 go build ${GOFLAGS} -ldflags "${LDFLAGS}" -o "$APPDIR/usr/bin/ollama-app" ./app/cmd/app

echo "--- Building ollama CLI ---"
CGO_ENABLED=1 go build ${GOFLAGS} -ldflags "${LDFLAGS}" -o "$APPDIR/usr/bin/ollama" .

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

    if [ -d "$DIST_DIR/lib/ollama" ]; then
        for f in "$DIST_DIR/lib/ollama/"*; do
            base="$(basename "$f")"
            case "$base" in
                llama-server) ;;
                *) cp -a "$f" "$APPDIR/usr/lib/ollama/" ;;
            esac
        done
    fi
else
    echo "WARNING: DIST_DIR not set; looking for llama-server on PATH" >&2
    if command -v ollama &>/dev/null; then
        ln -sf "$(command -v ollama)" "$APPDIR/usr/lib/ollama/llama-server"
        echo "  Symlinked ollama as llama-server (same binary handles both roles)" >&2
    else
        echo "  llama-server not available. AppImage will fall back to system PATH." >&2
    fi
fi

# Step 5: Create AppDir structure
echo "--- Creating AppDir structure ---"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/lib/ollama"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/22x22/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/scalable/apps"

# Copy .desktop file (linuxdeploy reads this for metadata)
cp "$ROOT_DIR/app/linux/com.ollama.Ollama.desktop" "$APPDIR/usr/share/applications/"
cp "$ROOT_DIR/app/linux/com.ollama.Ollama.desktop" "$APPDIR/"

# Copy icons
cp "$ROOT_DIR/app/assets/ollama.png" "$APPDIR/usr/share/icons/hicolor/256x256/apps/ollama.png"
cp "$ROOT_DIR/app/assets/ollama-tray.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-tray.png"
cp "$ROOT_DIR/app/assets/ollama-tray-dark.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-tray-dark.png"
cp "$ROOT_DIR/app/assets/ollama-update.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-update.png"
cp "$ROOT_DIR/app/assets/ollama-update-dark.png" "$APPDIR/usr/share/icons/hicolor/22x22/apps/ollama-update-dark.png"
cp "$ROOT_DIR/app/assets/ollama.png" "$APPDIR/"

# Create AppRun (basic one; linuxdeploy may overlay it)
cat > "$APPDIR/AppRun" << 'APPRUN'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
export XDG_DATA_DIRS="${HERE}/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH:-}"
exec "${HERE}/usr/bin/ollama-app" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

# Step 6: Bundle libnotify for desktop notifications
echo "--- Bundling libnotify for notifications ---"
if [ -d "$APPDIR/usr/lib" ]; then
    for lib in libnotify.so.4 libnotify.so; do
        if [ -f "/usr/lib/x86_64-linux-gnu/$lib" ]; then
            cp "/usr/lib/x86_64-linux-gnu/$lib" "$APPDIR/usr/lib/"
        fi
    done
fi

# Step 7: Bundle shared libraries using linuxdeploy
if [ -x "$LINUXDEPLOY" ]; then
    echo "--- Bundling shared library dependencies ---"
    LDP_PLUGIN="$LINGPU" "$LINUXDEPLOY" \
        --appdir "$APPDIR" \
        --desktop-file "$APPDIR/usr/share/applications/com.ollama.Ollama.desktop" \
        --icon-file "$APPDIR/ollama.png" \
        --output appimage \
        2>&1
    mv "$ROOT_DIR/Ollama"*.AppImage "$BUILD_DIR/ollama-linux-amd64.AppImage" 2>/dev/null || true
    echo "=== AppImage created: $BUILD_DIR/ollama-linux-amd64.AppImage ==="
elif command -v appimagetool &>/dev/null; then
    echo "--- linuxdeploy not found; using appimagetool (no bundled libs) ---"
    echo "WARNING: AppImage will require system GTK/WebKit libs." >&2
    ARCH_TAG="$(uname -m)"
    case "$ARCH_TAG" in
        x86_64) ARCH_FILENAME="amd64" ;;
        aarch64|arm64) ARCH_FILENAME="arm64" ;;
    esac
    ARCH="$ARCH_TAG" appimagetool "$APPDIR" "$BUILD_DIR/ollama-linux-${ARCH_FILENAME}.AppImage"
    echo "=== AppImage created: $BUILD_DIR/ollama-linux-${ARCH_FILENAME}.AppImage ==="
else
    echo "=== AppDir created at $APPDIR ==="
    echo "=== Install linuxdeploy or appimagetool to create AppImage ==="
fi