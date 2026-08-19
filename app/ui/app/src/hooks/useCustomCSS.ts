import { useEffect } from "react";
import { useSettings } from "./useSettings";

/**
 * Injects custom CSS from settings into the document head.
 * Uses textContent (not innerHTML) for XSS safety.
 */
export function useCustomCSS() {
  const { settingsData } = useSettings();
  const css = (settingsData as any)?.CustomCSS ?? "";

  useEffect(() => {
    let styleEl = document.getElementById("custom-css") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }, [css]);
}