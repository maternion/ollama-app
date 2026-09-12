import { useEffect, useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Field, Label, Description } from "@/components/ui/fieldset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  WifiIcon,
  FolderIcon,
  BoltIcon,
  WrenchIcon,
  CloudIcon,
  ArrowDownTrayIcon,
  CodeBracketIcon,
  TagIcon,
  SignalIcon,
  SparklesIcon,
  DocumentTextIcon,
  ServerStackIcon,
  AdjustmentsHorizontalIcon,
  ChatBubbleLeftRightIcon,
  PaintBrushIcon,
  PencilSquareIcon,
} from "@heroicons/react/20/solid";
import { CogIcon } from "@heroicons/react/24/outline";
import { Settings as SettingsType } from "@/gotypes";
import { useUser } from "@/hooks/useUser";
import { useCloudStatus } from "@/hooks/useCloudStatus";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  type CloudStatusResponse,
  updateCloudSetting,
  updateSettings,
  getInferenceCompute,
} from "@/api";
import { McpServerAddDialog } from "@/components/McpServerAddDialog";
import type { McpServerConfig } from "@/lib/recommended-mcp-servers";

function AnimatedDots() {
  return (
    <span className="inline-flex">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
        .
      </span>
      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
        .
      </span>
    </span>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [showSaved, setShowSaved] = useState(false);
  const [restartMessage, setRestartMessage] = useState(false);
  const {
    user,
    isAuthenticated,
    refreshUser,
    isRefreshing,
    refetchUser,
    fetchConnectUrl,
    isLoading,
    disconnectUser,
  } = useUser();
  const [isAwaitingConnection, setIsAwaitingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);
  const {
    cloudDisabled,
    cloudStatus,
    isLoading: cloudStatusLoading,
  } = useCloudStatus();

  const {
    data: settingsData,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const settings = settingsData?.settings || null;

  const { data: inferenceComputeResponse } = useQuery({
    queryKey: ["inferenceCompute"],
    queryFn: getInferenceCompute,
  });

  const defaultContextLength = inferenceComputeResponse?.defaultContextLength;

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    },
  });

  const updateCloudMutation = useMutation({
    mutationFn: (enabled: boolean) => updateCloudSetting(enabled),
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["cloudStatus"] });

      const previous = queryClient.getQueryData<CloudStatusResponse | null>([
        "cloudStatus",
      ]);
      const envForcesDisabled =
        previous?.source === "env" || previous?.source === "both";

      queryClient.setQueryData<CloudStatusResponse | null>(
        ["cloudStatus"],
        previous
          ? {
              ...previous,
              disabled: !enabled || envForcesDisabled,
            }
          : {
              disabled: !enabled,
              source: "config",
            },
      );

      return { previous };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["cloudStatus"], context.previous);
      }
    },
    onSuccess: (status) => {
      queryClient.setQueryData<CloudStatusResponse | null>(
        ["cloudStatus"],
        status,
      );
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["cloudStatus"] });

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    },
  });

  useEffect(() => {
    refetchUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleFocus = () => {
      if (isAwaitingConnection && pollingInterval) {
        // Stop polling when window gets focus
        clearInterval(pollingInterval);
        setPollingInterval(null);
        // Reset awaiting connection state
        setIsAwaitingConnection(false);
        // Make one last refresh request
        refreshUser();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAwaitingConnection, refreshUser, pollingInterval]);

  // Check if user is authenticated after refresh
  useEffect(() => {
    if (isAwaitingConnection && isAuthenticated) {
      setIsAwaitingConnection(false);
      setConnectionError(null);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [isAuthenticated, isAwaitingConnection, pollingInterval]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleChange = useCallback(
    (field: keyof SettingsType, value: boolean | string | number) => {
      if (settings) {
        const updatedSettings = new SettingsType({
          ...settings,
          [field]: value,
        });

        // If context length is being changed, show restart message
        if (field === "ContextLength" && value !== settings.ContextLength) {
          setRestartMessage(true);
          // Hide restart message after 3 seconds
          setTimeout(() => setRestartMessage(false), 3000);
        }

        updateSettingsMutation.mutate(updatedSettings);
      }
    },
    [settings, updateSettingsMutation],
  );

  const handleResetToDefaults = () => {
    if (settings) {
      const defaultSettings = new SettingsType({
        ...settings,
        Expose: false,
        Browser: false,
        Models: "",
        Agent: false,
        Tools: false,
        ContextLength: 0,
        AutoUpdateEnabled: false,
        CustomCSS: "",
        ShowRawOutput: false,
        ShowModelQuantization: false,
        ShowModelTags: false,
        TitleGenerationUseLLM: false,
        TitleGenerationUseFirstLine: false,
        TitleGenerationPrompt: "",
        AskForTitleConfirmation: false,
        McpServers: "",
        PdfMode: "text",
        SystemMessage: "",
        ShowSystemMessage: false,
        Temperature: 0.8,
        TopK: 40,
        TopP: 0.9,
        MinP: 0,
        RepeatPenalty: 1.0,
        PresencePenalty: 0,
        FrequencyPenalty: 0,
        ShowModelLoadStatus: false,
      });
      updateSettingsMutation.mutate(defaultSettings);
    }
  };

  const mcpServerList: McpServerConfig[] = (() => {
    try {
      const raw = (settings as any)?.McpServers || "";
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const handleAddMcpServer = (server: McpServerConfig) => {
    const updated = [...mcpServerList, server];
    handleChange("McpServers" as any, JSON.stringify(updated, null, 2));
  };

  const cloudOverriddenByEnv =
    cloudStatus?.source === "env" || cloudStatus?.source === "both";
  const cloudToggleDisabled =
    cloudStatusLoading || updateCloudMutation.isPending || cloudOverriddenByEnv;

  const handleConnectOllamaAccount = async () => {
    setConnectionError(null);

    // If user is already authenticated, no need to connect
    if (isAuthenticated) {
      return;
    }

    try {
      // If we don't have a user or user has no name, get connect URL
      if (!user || !user?.name) {
        const { data: connectUrl } = await fetchConnectUrl();
        if (connectUrl) {
          window.open(connectUrl, "_blank");
          setIsAwaitingConnection(true);
          // Start polling every 5 seconds
          const interval = setInterval(() => {
            refreshUser();
          }, 5000);
          setPollingInterval(interval);
        } else {
          setConnectionError("Failed to get connect URL");
        }
      }
    } catch (error) {
      console.error("Error connecting to Ollama account:", error);
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Failed to connect to Ollama account",
      );
      setIsAwaitingConnection(false);
    }
  };

  if (loading) {
    return null;
  }

  if (error || !settings) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-red-500">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
      <div className="space-y-4 max-w-2xl mx-auto">
          {/* Connect Ollama Account */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="p-4">
              <Field>
                {isLoading ? (
                  // Loading skeleton, this will only happen if the app started recently
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse w-24"></div>
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse w-32"></div>
                    </div>
                    <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse"></div>
                  </div>
                ) : user && user.name ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm font-medium text-neutral-900 dark:text-white">
                          {user?.name}
                        </Label>
                      </div>
                      <Description className="text-sm text-neutral-500 dark:text-neutral-400">
                        {user?.email}
                      </Description>
                      <div className="flex items-center space-x-2 mt-2">
                        {user?.plan === "free" && (
                          <Button
                            type="button"
                            color="dark"
                            className="px-3 py-2 text-sm font-medium bg-black/90 backdrop-blur-sm text-white rounded-lg border border-white/10 shadow-2xl transition-all duration-300 ease-out relative overflow-hidden group"
                            onClick={() =>
                              window.open(
                                "https://ollama.com/upgrade",
                                "_blank",
                              )
                            }
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-green-500/20 opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out"></div>
                            <span className="relative z-10 flex items-center space-x-2">
                              <span>Upgrade</span>
                            </span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          color="white"
                          className="px-3 py-2 text-sm"
                          onClick={() =>
                            window.open("https://ollama.com/settings", "_blank")
                          }
                        >
                          Manage
                        </Button>
                        <Button
                          type="button"
                          color="zinc"
                          className="px-3 py-2 text-sm"
                          onClick={() => disconnectUser()}
                        >
                          Sign out
                        </Button>
                      </div>
                    </div>
                    {user?.avatarurl && (
                      <img
                        src={user.avatarurl}
                        alt={user?.name}
                        className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.className = "hidden";
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Ollama account</Label>
                      <Description>Not connected</Description>
                    </div>
                    <Button
                      type="button"
                      color="white"
                      onClick={handleConnectOllamaAccount}
                      disabled={isRefreshing || isAwaitingConnection}
                    >
                      {isRefreshing || isAwaitingConnection ? (
                        <AnimatedDots />
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </div>
                )}
              </Field>
              {connectionError && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <Text className="text-sm text-red-600 dark:text-red-400">
                    {connectionError}
                  </Text>
                </div>
              )}
            </div>
          </div>
          {/* Local Configuration */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <CloudIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Cloud</Label>
                      <Description>
                        {cloudOverriddenByEnv
                          ? "The OLLAMA_NO_CLOUD environment variable is currently forcing cloud off."
                          : "Enable cloud models and web search."}
                      </Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={!cloudDisabled}
                      disabled={cloudToggleDisabled}
                      onChange={(checked) => {
                        if (cloudOverriddenByEnv) {
                          return;
                        }
                        updateCloudMutation.mutate(checked);
                      }}
                    />
                  </div>
                </div>
              </Field>

              {/* Auto Update */}
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <ArrowDownTrayIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Auto-download updates</Label>
                      <Description>
                        {settings.AutoUpdateEnabled
                          ? "Automatically download updates when available."
                          : "Updates will not be downloaded automatically."}
                      </Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={settings.AutoUpdateEnabled}
                      onChange={(checked) => handleChange("AutoUpdateEnabled", checked)}
                    />
                  </div>
                </div>
              </Field>

              {/* Chat Import / Export */}
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <ArrowDownTrayIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Chat backup</Label>
                      <Description>
                        Export all chats as a JSON file or import from a previous backup.
                      </Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await window.exportAllChats?.();
                        } catch (e) {
                          console.error("Export failed:", e);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-zinc-950/90 rounded-full shadow-sm cursor-pointer hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:border-zinc-950/10 dark:hover:bg-neutral-100"
                    >
                      Export
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await window.importChats?.();
                          queryClient.invalidateQueries({ queryKey: ["chats"] });
                        } catch (e) {
                          console.error("Import failed:", e);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-zinc-950/90 rounded-full shadow-sm cursor-pointer hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:border-zinc-950/10 dark:hover:bg-neutral-100"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </Field>

              {/* Expose Ollama */}
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <WifiIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Expose Ollama to the network</Label>
                      <Description>
                        Allow other devices or services to access Ollama.
                      </Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={settings.Expose}
                      onChange={(checked) => handleChange("Expose", checked)}
                    />
                  </div>
                </div>
              </Field>

              {/* Model Directory */}
              <Field>
                <div className="flex items-start space-x-3">
                  <FolderIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>Model location</Label>
                    <Description>Location where models are stored.</Description>
                    <div className="mt-2 flex items-center space-x-2">
                      <Input
                        value={settings.Models || ""}
                        onChange={(e) => handleChange("Models", e.target.value)}
                        readOnly
                      />
                      <Button
                        type="button"
                        color="white"
                        className="px-2"
                        onClick={async () => {
                          if (window.webview?.selectModelsDirectory) {
                            try {
                              const directory =
                                await window.webview.selectModelsDirectory();
                              if (directory) {
                                handleChange("Models", directory);
                              }
                            } catch (error) {
                              console.error(
                                "Error selecting models directory:",
                                error,
                              );
                            }
                          }
                        }}
                      >
                        <FolderIcon className="w-4 h-4 mr-1" />
                        Browse
                      </Button>
                    </div>
                  </div>
                </div>
              </Field>

              {/* Context Length */}
              <Field>
                <div className="flex items-start space-x-3">
                  <CogIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>Context length</Label>
                    <Description>
                      Context length determines how much of your conversation
                      local LLMs can remember and use to generate responses.
                    </Description>
                    <div className="mt-3">
                      <Slider
                        value={settings.ContextLength || defaultContextLength || 0}
                        onChange={(value) => {
                          handleChange("ContextLength", value);
                        }}
                        disabled={!defaultContextLength}
                        options={[
                          { value: 4096, label: "4k" },
                          { value: 8192, label: "8k" },
                          { value: 16384, label: "16k" },
                          { value: 32768, label: "32k" },
                          { value: 65536, label: "64k" },
                          { value: 131072, label: "128k" },
                          { value: 262144, label: "256k" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Custom CSS */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start space-x-3">
                  <PaintBrushIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>Custom CSS</Label>
                    <Description>Inject custom CSS styles into the app UI.</Description>
                    <textarea
                      value={(settings as any)?.CustomCSS || ""}
                      onChange={(e) => handleChange("CustomCSS" as any, e.target.value)}
                      className="mt-2 w-full h-32 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm font-mono text-neutral-900 dark:text-neutral-100"
                      placeholder="/* Your custom CSS here */"
                    />
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Display Settings */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <CodeBracketIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Show raw output toggle</Label>
                      <Description>Show a toggle on assistant messages to display raw text instead of formatted Markdown.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.ShowRawOutput || false}
                      onChange={(checked) => handleChange("ShowRawOutput" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <TagIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Show model quantization</Label>
                      <Description>Display quantization level (e.g., Q4_K_M) in the model picker.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.ShowModelQuantization || false}
                      onChange={(checked) => handleChange("ShowModelQuantization" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <TagIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Show model tags</Label>
                      <Description>Display parameter size and family badges in the model picker.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.ShowModelTags || false}
                      onChange={(checked) => handleChange("ShowModelTags" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <SignalIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Show model load status</Label>
                      <Description>Display which models are currently loaded in memory in the model picker.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.ShowModelLoadStatus || false}
                      onChange={(checked) => handleChange("ShowModelLoadStatus" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Title Generation */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <SparklesIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Use LLM to generate titles</Label>
                      <Description>Send a secondary LLM request to generate a descriptive title.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.TitleGenerationUseLLM || false}
                      onChange={(checked) => handleChange("TitleGenerationUseLLM" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <DocumentTextIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Use first line as title</Label>
                      <Description>Use the first line of the user's message as the chat title.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.TitleGenerationUseFirstLine || false}
                      onChange={(checked) => handleChange("TitleGenerationUseFirstLine" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <ChatBubbleLeftRightIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Ask for confirmation</Label>
                      <Description>Show a confirmation dialog before applying a generated title.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.AskForTitleConfirmation || false}
                      onChange={(checked) => handleChange("AskForTitleConfirmation" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
              <Field>
                <div className="flex items-start space-x-3">
                  <PencilSquareIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>Custom title prompt</Label>
                    <Description>Custom prompt template. Use {"{{USER}}"} and {"{{ASSISTANT}}"} placeholders. Leave empty for default.</Description>
                    <textarea
                      value={(settings as any)?.TitleGenerationPrompt || ""}
                      onChange={(e) => handleChange("TitleGenerationPrompt" as any, e.target.value)}
                      className="mt-2 w-full h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm text-neutral-900 dark:text-neutral-100"
                      placeholder="Generate a short title for this conversation..."
                    />
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* PDF Processing */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start space-x-3">
                  <DocumentTextIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>PDF Processing Mode</Label>
                    <Description>Choose how PDF files are processed when attached to chats.</Description>
                    <div className="mt-2 inline-flex w-full max-w-md rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-0.5">
                      {([
                        { value: "text", label: "Extract text", hint: "Works with all models" },
                        { value: "images", label: "Render as images", hint: "Requires vision model" },
                      ] as const).map((opt) => {
                        const active = ((settings as any)?.PdfMode || "text") === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleChange("PdfMode" as any, opt.value)}
                            className={`flex-1 rounded-md px-3 py-1.5 text-left transition-colors cursor-pointer ${
                              active
                                ? "bg-white dark:bg-neutral-700 shadow-sm"
                                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            }`}
                          >
                            <div className={`text-sm font-medium ${active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"}`}>
                              {opt.label}
                            </div>
                            <div className="text-xs text-neutral-400 dark:text-neutral-500">
                              {opt.hint}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* MCP Servers */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start space-x-3">
                  <ServerStackIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div className="w-full">
                    <Label>MCP Servers</Label>
                    <Description>Configure Model Context Protocol servers. Server connections will be available in a future update.</Description>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setMcpDialogOpen(true)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-zinc-950/90 rounded-full shadow-sm cursor-pointer hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:border-zinc-950/10 dark:hover:bg-neutral-100"
                      >
                        Add server
                      </button>
                    </div>
                    <textarea
                      value={(settings as any)?.McpServers || ""}
                      onChange={(e) => handleChange("McpServers" as any, e.target.value)}
                      className="mt-2 w-full h-32 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm font-mono text-neutral-900 dark:text-neutral-100"
                      placeholder='[{"id":"example","name":"Example","url":"https://example.com/mcp","enabled":false}]'
                    />
                    <Description>JSON array of MCP server configurations. Format: id, name, url, enabled, description.</Description>
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Sampling Parameters */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start space-x-3">
                  <AdjustmentsHorizontalIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                  <div>
                    <Label>Sampling Parameters</Label>
                    <Description>Control how the model generates responses. Leave at defaults for standard behavior.</Description>
                  </div>
                </div>
              </Field>

              {/* Temperature */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Temperature: {((settings as any)?.Temperature ?? 0.8).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.Temperature ?? 0.8}
                  onChange={(value) => handleChange("Temperature" as any, value)}
                  options={[
                    { value: 0, label: "0" },
                    { value: 0.2, label: "0.2" },
                    { value: 0.4, label: "0.4" },
                    { value: 0.6, label: "0.6" },
                    { value: 0.8, label: "0.8" },
                    { value: 1.0, label: "1.0" },
                    { value: 1.2, label: "1.2" },
                    { value: 1.5, label: "1.5" },
                    { value: 2.0, label: "2.0" },
                  ]}
                />
              </Field>

              {/* Top P */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Top P: {((settings as any)?.TopP ?? 0.9).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.TopP ?? 0.9}
                  onChange={(value) => handleChange("TopP" as any, value)}
                  options={[
                    { value: 0.1, label: "0.1" },
                    { value: 0.3, label: "0.3" },
                    { value: 0.5, label: "0.5" },
                    { value: 0.7, label: "0.7" },
                    { value: 0.9, label: "0.9" },
                    { value: 1.0, label: "1.0" },
                  ]}
                />
              </Field>

              {/* Top K */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Top K: {(settings as any)?.TopK ?? 40}</Label>
                </div>
                <Slider
                  value={(settings as any)?.TopK ?? 40}
                  onChange={(value) => handleChange("TopK" as any, value)}
                  options={[
                    { value: 1, label: "1" },
                    { value: 10, label: "10" },
                    { value: 20, label: "20" },
                    { value: 40, label: "40" },
                    { value: 60, label: "60" },
                    { value: 80, label: "80" },
                    { value: 100, label: "100" },
                  ]}
                />
              </Field>

              {/* Min P */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Min P: {((settings as any)?.MinP ?? 0).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.MinP ?? 0}
                  onChange={(value) => handleChange("MinP" as any, value)}
                  options={[
                    { value: 0, label: "0" },
                    { value: 0.05, label: "0.05" },
                    { value: 0.1, label: "0.1" },
                    { value: 0.2, label: "0.2" },
                    { value: 0.3, label: "0.3" },
                    { value: 0.5, label: "0.5" },
                  ]}
                />
              </Field>

              {/* Repeat Penalty */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Repeat Penalty: {((settings as any)?.RepeatPenalty ?? 1.0).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.RepeatPenalty ?? 1.0}
                  onChange={(value) => handleChange("RepeatPenalty" as any, value)}
                  options={[
                    { value: 0.8, label: "0.8" },
                    { value: 0.9, label: "0.9" },
                    { value: 1.0, label: "1.0" },
                    { value: 1.1, label: "1.1" },
                    { value: 1.2, label: "1.2" },
                    { value: 1.3, label: "1.3" },
                    { value: 1.5, label: "1.5" },
                  ]}
                />
              </Field>

              {/* Presence Penalty */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Presence Penalty: {((settings as any)?.PresencePenalty ?? 0).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.PresencePenalty ?? 0}
                  onChange={(value) => handleChange("PresencePenalty" as any, value)}
                  options={[
                    { value: 0, label: "0" },
                    { value: 0.5, label: "0.5" },
                    { value: 1.0, label: "1.0" },
                    { value: 1.5, label: "1.5" },
                    { value: 2.0, label: "2.0" },
                  ]}
                />
              </Field>

              {/* Frequency Penalty */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label>Frequency Penalty: {((settings as any)?.FrequencyPenalty ?? 0).toFixed(1)}</Label>
                </div>
                <Slider
                  value={(settings as any)?.FrequencyPenalty ?? 0}
                  onChange={(value) => handleChange("FrequencyPenalty" as any, value)}
                  options={[
                    { value: 0, label: "0" },
                    { value: 0.5, label: "0.5" },
                    { value: 1.0, label: "1.0" },
                    { value: 1.5, label: "1.5" },
                    { value: 2.0, label: "2.0" },
                  ]}
                />
              </Field>
            </div>
          </div>

          {/* System Message Display */}
          <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <div className="space-y-4 p-4">
              <Field>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <ChatBubbleLeftRightIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                    <div>
                      <Label>Show system messages</Label>
                      <Description>Display system messages in the conversation view. Set per-chat using the + menu.</Description>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={(settings as any)?.ShowSystemMessage || false}
                      onChange={(checked) => handleChange("ShowSystemMessage" as any, checked)}
                    />
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Agent Mode */}
          {window.OLLAMA_TOOLS && (
            <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
              <div className="space-y-4 p-4">
                <Field>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <BoltIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                      <div>
                        <Label>Enable Agent Mode</Label>
                        <Description>
                          Use multi-turn tools to fulfill user requests
                        </Description>
                      </div>
                    </div>
                    <Switch
                      checked={settings.Agent}
                      onChange={(checked) => handleChange("Agent", checked)}
                    />
                  </div>
                </Field>

                {/* Tools Mode */}
                <Field>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <WrenchIcon className="mt-1 h-5 w-5 flex-shrink-0 text-black dark:text-neutral-100" />
                      <div>
                        <Label>Enable Tools Mode</Label>
                        <Description>
                          Use single-turn tools to fulfill user requests
                        </Description>
                      </div>
                    </div>
                    <Switch
                      checked={settings.Tools}
                      onChange={(checked) => handleChange("Tools", checked)}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* Reset button */}
          <div className="mt-6 flex justify-end px-4">
            <Button
              type="button"
              color="white"
              className="px-3"
              onClick={handleResetToDefaults}
            >
              Reset to defaults
            </Button>
          </div>
      </div>

      {(showSaved || restartMessage) && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 transition-opacity duration-300 z-50">
          <Badge
            color="green"
            className="!bg-green-500 !text-white dark:!bg-green-600"
          >
            Saved
          </Badge>
        </div>
      )}

      <McpServerAddDialog
        open={mcpDialogOpen}
        existingServers={mcpServerList}
        onAdd={handleAddMcpServer}
        onClose={() => setMcpDialogOpen(false)}
      />
    </div>
  );
}
