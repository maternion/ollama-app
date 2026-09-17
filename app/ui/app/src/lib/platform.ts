export function isWindowsPlatform(): boolean {
  if (typeof window !== "undefined" && window.OLLAMA_PLATFORM) {
    return window.OLLAMA_PLATFORM === "windows";
  }

  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("win")
  );
}

/**
 * Returns true on the Linux desktop app. WebKitGTK's JS engine
 * (JavaScriptCore) and compositor are slower than V8 (Windows WebView2)
 * and macOS WKWebView, so the shared upstream rendering pipeline
 * (Streamdown full re-parse at 250fps) freezes on Linux while remaining
 * merely sluggish on Mac/Windows. Use this to throttle batch flushes
 * and other per-token work on Linux.
 */
export function isLinuxPlatform(): boolean {
  if (typeof window !== "undefined" && window.OLLAMA_PLATFORM) {
    return window.OLLAMA_PLATFORM === "linux";
  }

  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("linux")
  );
}
