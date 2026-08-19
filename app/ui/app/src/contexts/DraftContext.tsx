import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

interface Draft {
  content: string;
}

interface DraftContextType {
  saveDraft: (chatId: string, content: string) => void;
  getDraft: (chatId: string) => string;
  clearDraft: (chatId: string) => void;
  hasDraft: (chatId: string) => boolean;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());

  const saveDraft = (chatId: string, content: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      if (content.trim()) {
        next.set(chatId, { content });
      } else {
        next.delete(chatId);
      }
      return next;
    });
  };

  const getDraft = (chatId: string) => drafts.get(chatId)?.content ?? "";

  const clearDraft = (chatId: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.delete(chatId);
      return next;
    });
  };

  const hasDraft = (chatId: string) => drafts.has(chatId);

  const contextValue = useMemo(
    () => ({ saveDraft, getDraft, clearDraft, hasDraft }),
    [drafts],
  );

  return (
    <DraftContext.Provider value={contextValue}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (context === undefined) {
    throw new Error("useDraft must be used within a DraftProvider");
  }
  return context;
}