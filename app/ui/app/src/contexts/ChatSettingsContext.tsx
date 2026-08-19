import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

export interface PerChatSettings {
  systemMessage: string;
  schemaActive: boolean;
  schema: string;
  thinkLevel: string; // "off" | "low" | "medium" | "high" | "max"
  webSearchEnabled: boolean;
}

const DEFAULT_SETTINGS: PerChatSettings = {
  systemMessage: "",
  schemaActive: false,
  schema: "",
  thinkLevel: "medium",
  webSearchEnabled: false,
};

interface ChatSettingsContextType {
  getChatSettings: (chatId: string) => PerChatSettings;
  updateChatSettings: (
    chatId: string,
    updates: Partial<PerChatSettings>,
  ) => void;
  clearChatSettings: (chatId: string) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextType | undefined>(
  undefined,
);

export function ChatSettingsProvider({ children }: { children: ReactNode }) {
  const [settingsMap, setSettingsMap] = useState<Map<string, PerChatSettings>>(
    new Map(),
  );

  const getChatSettings = (chatId: string): PerChatSettings =>
    settingsMap.get(chatId) ?? DEFAULT_SETTINGS;

  const updateChatSettings = (
    chatId: string,
    updates: Partial<PerChatSettings>,
  ) => {
    setSettingsMap((prev) => {
      const next = new Map(prev);
      const current = next.get(chatId) ?? DEFAULT_SETTINGS;
      next.set(chatId, { ...current, ...updates });
      return next;
    });
  };

  const clearChatSettings = (chatId: string) => {
    setSettingsMap((prev) => {
      const next = new Map(prev);
      next.delete(chatId);
      return next;
    });
  };

  const contextValue = useMemo(
    () => ({ getChatSettings, updateChatSettings, clearChatSettings }),
    [settingsMap],
  );

  return (
    <ChatSettingsContext.Provider value={contextValue}>
      {children}
    </ChatSettingsContext.Provider>
  );
}

export function useChatSettings() {
  const context = useContext(ChatSettingsContext);
  if (context === undefined) {
    throw new Error("useChatSettings must be used within a ChatSettingsProvider");
  }
  return context;
}