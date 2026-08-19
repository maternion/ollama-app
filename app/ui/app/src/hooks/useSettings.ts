import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "@/gotypes";
import { getSettings, updateSettings } from "@/api";
import { useMemo, useCallback } from "react";

// TODO(hoyyeva): remove turboEnabled when we remove Migration logic in useSelectedModel.ts
interface SettingsState {
  turboEnabled: boolean;
  webSearchEnabled: boolean;
  selectedModel: string;
  sidebarOpen: boolean;
  lastHomeView: string;
  thinkEnabled: boolean;
  thinkLevel: string;
  showRawOutput: boolean;
  showModelQuantization: boolean;
  showModelTags: boolean;
  titleGenerationUseLLM: boolean;
  titleGenerationUseFirstLine: boolean;
  titleGenerationPrompt: string;
  askForTitleConfirmation: boolean;
  pdfMode: string;
}

// Type for partial settings updates
type SettingsUpdate = Partial<{
  TurboEnabled: boolean;
  WebSearchEnabled: boolean;
  ThinkEnabled: boolean;
  ThinkLevel: string;
  SelectedModel: string;
  SidebarOpen: boolean;
  LastHomeView: string;
  ShowRawOutput: boolean;
  ShowModelQuantization: boolean;
  ShowModelTags: boolean;
  TitleGenerationUseLLM: boolean;
  TitleGenerationUseFirstLine: boolean;
  TitleGenerationPrompt: string;
  AskForTitleConfirmation: boolean;
  PdfMode: string;
  CustomCSS: string;
  APIKey: string;
  McpServers: string;
}>;

export function useSettings() {
  const queryClient = useQueryClient();

  // Fetch settings with useQuery
  const { data: settingsData, error } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Update settings with useMutation
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      // Invalidate the query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // Extract settings with defaults
  const settings: SettingsState = useMemo(
    () => ({
      turboEnabled: settingsData?.settings?.TurboEnabled ?? false,
      webSearchEnabled: settingsData?.settings?.WebSearchEnabled ?? false,
      thinkEnabled: settingsData?.settings?.ThinkEnabled ?? false,
      thinkLevel: settingsData?.settings?.ThinkLevel ?? "none",
      selectedModel: settingsData?.settings?.SelectedModel ?? "",
      sidebarOpen: settingsData?.settings?.SidebarOpen ?? false,
      lastHomeView: settingsData?.settings?.LastHomeView ?? "launch",
      showRawOutput: (settingsData?.settings as any)?.ShowRawOutput ?? false,
      showModelQuantization:
        (settingsData?.settings as any)?.ShowModelQuantization ?? false,
      showModelTags: (settingsData?.settings as any)?.ShowModelTags ?? false,
      titleGenerationUseLLM:
        (settingsData?.settings as any)?.TitleGenerationUseLLM ?? false,
      titleGenerationUseFirstLine:
        (settingsData?.settings as any)?.TitleGenerationUseFirstLine ?? false,
      titleGenerationPrompt:
        (settingsData?.settings as any)?.TitleGenerationPrompt ?? "",
      askForTitleConfirmation:
        (settingsData?.settings as any)?.AskForTitleConfirmation ?? false,
      pdfMode: (settingsData?.settings as any)?.PdfMode ?? "text",
    }),
    [settingsData?.settings],
  );

  // Single function to update most settings
  const setSettings = useCallback(
    async (updates: SettingsUpdate) => {
      if (!settingsData?.settings) return;

      const updatedSettings = new Settings({
        ...settingsData.settings,
        ...updates,
      });

      await updateSettingsMutation.mutateAsync(updatedSettings);
    },
    [settingsData?.settings, updateSettingsMutation],
  );

  return useMemo(
    () => ({
      settings,
      settingsData: settingsData?.settings,
      error,
      setSettings,
    }),
    [settings, settingsData?.settings, error, setSettings],
  );
}
