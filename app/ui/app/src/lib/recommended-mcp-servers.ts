export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  description?: string;
  needsAuthorization?: boolean;
}

export const RECOMMENDED_MCP_SERVERS: McpServerConfig[] = [
  {
    id: "exa",
    name: "Exa Web Search",
    url: "https://mcp.exa.ai/mcp",
    enabled: false,
    description: "Web search via Exa",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    url: "https://huggingface.co/mcp",
    enabled: false,
    description: "Search models and datasets on Hugging Face",
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://api.githubcopilot.com/mcp/",
    enabled: false,
    description: "GitHub repos, issues, and PRs (requires token)",
    needsAuthorization: true,
  },
  {
    id: "context7",
    name: "Context7",
    url: "https://mcp.context7.com/mcp",
    enabled: false,
    description: "Up-to-date library documentation",
  },
];

/**
 * Canonicalize a URL to prevent duplicate server entries.
 * Normalizes protocol, removes trailing slashes, and lowercases the host.
 */
export function canonicalizeServerUrl(url: string): string {
  let normalized = url.trim();
  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, "");
  // Ensure protocol is lowercase
  normalized = normalized.replace(/^(HTTP|HTTPS):\/\//i, (m) => m.toLowerCase());
  return normalized;
}

/**
 * Check if a server URL is already in a list of configured servers.
 */
export function isServerAlreadyConfigured(
  url: string,
  existingServers: McpServerConfig[],
): boolean {
  const canonical = canonicalizeServerUrl(url);
  return existingServers.some(
    (s) => canonicalizeServerUrl(s.url) === canonical,
  );
}