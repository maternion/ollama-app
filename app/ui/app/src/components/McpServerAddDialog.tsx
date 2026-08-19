import { useState } from "react";
import {
  RECOMMENDED_MCP_SERVERS,
  canonicalizeServerUrl,
  isServerAlreadyConfigured,
  type McpServerConfig,
} from "@/lib/recommended-mcp-servers";

interface McpServerAddDialogProps {
  open: boolean;
  existingServers: McpServerConfig[];
  onAdd: (server: McpServerConfig) => void;
  onClose: () => void;
}

export function McpServerAddDialog({
  open,
  existingServers,
  onAdd,
  onClose,
}: McpServerAddDialogProps) {
  const [manualUrl, setManualUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleAddRecommended = (server: McpServerConfig) => {
    if (isServerAlreadyConfigured(server.url, existingServers)) {
      setError(`"${server.name}" is already configured`);
      return;
    }
    onAdd({ ...server, id: `mcp-${Date.now()}` });
  };

  const handleAddManual = () => {
    if (!manualUrl.trim()) {
      setError("Please enter a server URL");
      return;
    }
    if (isServerAlreadyConfigured(manualUrl, existingServers)) {
      setError("This server is already configured");
      return;
    }
    onAdd({
      id: `mcp-${Date.now()}`,
      name: manualName.trim() || manualUrl.trim(),
      url: canonicalizeServerUrl(manualUrl),
      enabled: true,
      description: "",
    });
    setManualUrl("");
    setManualName("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-neutral-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Add MCP Server
        </h2>

        {/* Recommended servers */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
            Recommended
          </h3>
          <div className="space-y-2">
            {RECOMMENDED_MCP_SERVERS.map((server) => {
              const alreadyAdded = isServerAlreadyConfigured(
                server.url,
                existingServers,
              );
              return (
                <div
                  key={server.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {server.name}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {server.description}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddRecommended(server)}
                    disabled={alreadyAdded}
                    className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100"
                  >
                    {alreadyAdded ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual entry */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
            Add manually
          </h3>
          <div className="space-y-2">
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Server name (optional)"
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
            <div className="flex gap-2">
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://example.com/mcp"
                className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              />
              <button
                onClick={handleAddManual}
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}