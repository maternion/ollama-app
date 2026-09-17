import { createHighlighter } from "shiki";
import type { ThemeRegistration, BundledLanguage } from "shiki";

const oneLightTheme: ThemeRegistration = {
  name: "one-light",
  type: "light",
  colors: {
    "editor.background": "#fafafa",
    "editor.foreground": "#383a42",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#a0a1a7" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#a626a4" },
    },
    { scope: ["string", "string.quoted"], settings: { foreground: "#50a14f" } },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#4078f2" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
        "number",
      ],
      settings: { foreground: "#c18401" },
    },
    {
      scope: ["variable", "support.variable"],
      settings: { foreground: "#e45649" },
    },
    {
      scope: ["entity.name.tag", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#e45649" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#c18401" },
    },
    {
      scope: ["keyword.operator", "operator"],
      settings: { foreground: "#a626a4" },
    },
    { scope: ["punctuation"], settings: { foreground: "#383a42" } },
    {
      scope: ["markup.heading"],
      settings: { foreground: "#e45649", fontStyle: "bold" },
    },
    {
      scope: ["markup.bold"],
      settings: { foreground: "#c18401", fontStyle: "bold" },
    },
    {
      scope: ["markup.italic"],
      settings: { foreground: "#a626a4", fontStyle: "italic" },
    },
  ],
};

const oneDarkTheme: ThemeRegistration = {
  name: "one-dark",
  type: "dark",
  colors: {
    "editor.background": "#282c34",
    "editor.foreground": "#abb2bf",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#5c6370" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#c678dd" },
    },
    { scope: ["string", "string.quoted"], settings: { foreground: "#98c379" } },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#61afef" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
        "number",
      ],
      settings: { foreground: "#d19a66" },
    },
    {
      scope: ["variable", "support.variable"],
      settings: { foreground: "#e06c75" },
    },
    {
      scope: ["entity.name.tag", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#e06c75" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#d19a66" },
    },
    {
      scope: ["keyword.operator", "operator"],
      settings: { foreground: "#c678dd" },
    },
    { scope: ["punctuation"], settings: { foreground: "#abb2bf" } },
    {
      scope: ["markup.heading"],
      settings: { foreground: "#e06c75", fontStyle: "bold" },
    },
    {
      scope: ["markup.bold"],
      settings: { foreground: "#d19a66", fontStyle: "bold" },
    },
    {
      scope: ["markup.italic"],
      settings: { foreground: "#c678dd", fontStyle: "italic" },
    },
  ],
};

export let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null =
  null;

// Map light theme token colors to dark theme equivalents. Token boundaries
// are grammar-determined (same across themes), so we tokenize once with the
// light theme and remap colors for dark mode via this lookup.
const LIGHT_TO_DARK: Record<string, string> = {
  "#a0a1a7": "#5c6370", // comment
  "#a626a4": "#c678dd", // keyword / operator
  "#50a14f": "#98c379", // string
  "#4078f2": "#61afef", // function
  "#c18401": "#d19a66", // numeric / attribute-name
  "#e45649": "#e06c75", // variable / tag
  "#383a42": "#abb2bf", // punctuation / default
};

const DARK_FOREGROUND = "#abb2bf";

export function darkColorFor(lightColor: string): string {
  return LIGHT_TO_DARK[lightColor] ?? DARK_FOREGROUND;
}

// LRU cache for tokenized code blocks, keyed by codeText + language.
// Avoids re-tokenizing identical code on re-mounts / re-opens / re-renders.
const TOKEN_CACHE_MAX = 256;
const tokenCache = new Map<string, any>();

function tokenCacheKey(codeText: string, lang: string): string {
  return `${lang}\0${codeText}`;
}

export function getCachedTokens(codeText: string, lang: string): any | null {
  if (!highlighter) return null;
  const key = tokenCacheKey(codeText, lang);
  const cached = tokenCache.get(key);
  if (cached) {
    // Move to end (most recently used)
    tokenCache.delete(key);
    tokenCache.set(key, cached);
    return cached;
  }
  try {
    const tokens = highlighter.codeToTokensBase(codeText, {
      lang: lang as BundledLanguage,
      theme: "one-light" as any,
    });
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      tokenCache.delete(tokenCache.keys().next().value!);
    }
    tokenCache.set(key, tokens);
    return tokens;
  } catch (error) {
    console.error("Failed to highlight code:", error);
    return null;
  }
}

export const highlighterPromise = createHighlighter({
  themes: [oneLightTheme, oneDarkTheme],
  langs: [
    "javascript",
    "typescript",
    "python",
    "bash",
    "shell",
    "json",
    "html",
    "css",
    "tsx",
    "jsx",
    "go",
    "rust",
    "java",
    "c",
    "cpp",
    "sql",
    "swift",
    "yaml",
    "markdown",
  ],
}).then((h) => {
  highlighter = h;
  return h;
});
