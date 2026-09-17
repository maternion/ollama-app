import { useChats } from "@/hooks/useChats";
import { useRenameChat } from "@/hooks/useRenameChat";
import { useDeleteChat } from "@/hooks/useDeleteChat";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { getChat } from "@/api";
import { Link } from "@/components/ui/link";
import { ChatsResponse } from "@/gotypes";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { useStreamingContext } from "@/contexts/StreamingContext";
import { AppNavigation } from "@/components/AppSidebar";

// there's a hidden debug feature to copy a chat's data to the clipboard by
// holding shift and clicking this many times within this many seconds
const DEBUG_SHIFT_CLICKS_REQUIRED = 5;
const DEBUG_SHIFT_CLICK_WINDOW_MS = 7000; // 7 seconds

interface ChatSidebarProps {
  currentChatId?: string;
}

export function ChatSidebar({ currentChatId }: ChatSidebarProps) {
  const { data, isLoading, error } = useChats();
  const { streamingChatIds } = useStreamingContext();
  const queryClient = useQueryClient();
  const renameMutation = useRenameChat();
  const deleteMutation = useDeleteChat();
const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState<string>("");
  const pendingDeleteIdRef = useRef<string | null>(null);
  const [shiftClicks, setShiftClicks] = useState<Record<string, number[]>>({});
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(
    (chatId: string) => {
      queryClient.prefetchQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(chatId),
        staleTime: 1500,
      });
    },
    [queryClient],
  );

  const startEditing = useCallback((chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditValue(currentTitle);
  }, []);

  const saveRename = useCallback(async () => {
    if (!editingChatId || !editValue.trim()) {
      setEditingChatId(null);
      return;
    }

    const newTitle = editValue.trim();
    const chatId = editingChatId;

    // Exit edit mode immediately to prevent flash
    setEditingChatId(null);
    setEditValue("");

    // Optimistically update the cache
    queryClient.setQueryData(
      ["chats"],
      (oldData: ChatsResponse | undefined) => {
        if (!oldData?.chatInfos) return oldData;
        return {
          ...oldData,
          chatInfos: oldData.chatInfos.map((chat) =>
            chat.id === chatId ? { ...chat, title: newTitle } : chat,
          ),
        };
      },
    );

    try {
      await renameMutation.mutateAsync({
        chatId: chatId,
        title: newTitle,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }
  }, [editingChatId, editValue, renameMutation, queryClient]);

  useEffect(() => {
    if (editingChatId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingChatId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        saveRename();
      }
    };

    if (editingChatId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [editingChatId, editValue, saveRename]);

  const sortedChats = useMemo(() => {
    if (!data?.chatInfos) return [];
    return [...data.chatInfos].sort((a, b) => {
      const comparison = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (comparison === 0) {
        return b.id.localeCompare(a.id);
      }
      return comparison;
    });
  }, [data?.chatInfos]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isThisWeek = (date: Date) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date > weekAgo && !isToday(date);
  };

  // Group chats by time period
  const groupedChats = useMemo(() => {
    const groups = {
      today: [] as typeof sortedChats,
      thisWeek: [] as typeof sortedChats,
      older: [] as typeof sortedChats,
    };

    sortedChats.forEach((chat) => {
      if (isToday(chat.updatedAt)) {
        groups.today.push(chat);
      } else if (isThisWeek(chat.updatedAt)) {
        groups.thisWeek.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    return groups;
  }, [sortedChats]);

  const chatGroups = useMemo(() => {
    return [
      { name: "Today", chats: groupedChats.today },
      { name: "This week", chats: groupedChats.thisWeek },
      { name: "Older", chats: groupedChats.older },
    ].filter((group) => group.chats.length > 0);
  }, [groupedChats]);

  const confirmDeleteChat = async () => {
    const chatId = pendingDeleteIdRef.current;
    if (!chatId) return;
    pendingDeleteIdRef.current = null;
    setPendingDeleteId(null);
    setPendingDeleteTitle("");
    try {
      await deleteMutation.mutateAsync(chatId);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Keep ref in sync for the confirm callback
  useEffect(() => {
    pendingDeleteIdRef.current = pendingDeleteId;
  }, [pendingDeleteId]);

  const handleExportChat = useCallback(async (chatId: string) => {
    try {
      await window.exportChat?.(chatId);
    } catch (error) {
      console.error("Failed to export chat:", error);
    }
    setMenuOpenChatId(null);
  }, []);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // If clicking inside the currently-open menu wrapper, do nothing
      if (target?.closest('[data-menu-open="true"]')) {
        return;
      }
      setMenuOpenChatId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // implementation of the hidden debug feature to copy a chat's data to the clipboard
  const handleShiftClick = useCallback(
    async (e: React.MouseEvent, chatId: string) => {
      if (!e.shiftKey) return false;

      e.preventDefault();
      const now = Date.now();

      const clicks = shiftClicks[chatId] || [];
      const recentClicks = clicks.filter(
        (timestamp) => now - timestamp < DEBUG_SHIFT_CLICK_WINDOW_MS,
      );
      recentClicks.push(now);

      setShiftClicks((prev) => ({
        ...prev,
        [chatId]: recentClicks,
      }));

      if (recentClicks.length >= DEBUG_SHIFT_CLICKS_REQUIRED) {
        try {
          const chatData = await getChat(chatId);
          const jsonString = JSON.stringify(chatData, null, 2);
          await navigator.clipboard.writeText(jsonString);

          // visual feedback
          setCopiedChatId(chatId);
          setTimeout(() => setCopiedChatId(null), 2000);

          setShiftClicks((prev) => ({
            ...prev,
            [chatId]: [],
          }));
        } catch (error) {
          console.error("Failed to copy chat data:", error);
        }
      }

      return true;
    },
    [shiftClicks],
  );

  const handleContextMenu = useCallback(
    async (_: React.MouseEvent, chatId: string, chatTitle: string) => {
      const selectedAction = await window.menu([
        { label: "Rename", enabled: true },
        { label: "Export", enabled: true },
        { label: "Delete", enabled: true },
      ]);

      if (selectedAction === "Rename") {
        startEditing(chatId, chatTitle);
      } else if (selectedAction === "Export") {
        handleExportChat(chatId);
      } else if (selectedAction === "Delete") {
        setPendingDeleteId(chatId);
        setPendingDeleteTitle(chatTitle);
      }
    },
    [startEditing, handleExportChat],
  );

  if (isLoading) {
    return (
      <nav className="flex min-h-0 flex-col">
        <div className="flex flex-1 flex-col p-4">
          <div className="p-4">Loading...</div>
        </div>
      </nav>
    );
  }

  if (error) {
    return (
      <nav className="flex min-h-0 flex-col">
        <div className="flex flex-1 flex-col p-4">
          <div className="p-4 text-red-500">Error loading chats</div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col min-h-0 select-none">
      <header className="flex flex-col gap-0.5 px-4 pb-2">
        <AppNavigation current="chat" />
      </header>
      <div className="flex flex-1 flex-col px-4 py-1 overflow-y-auto overscroll-auto scrollbar-gutter">
        <div className="flex flex-col gap-3 pt-4">
          {chatGroups.map((group) => (
            <div key={group.name} className="flex flex-col gap-0.5">
              <h3 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 px-2 py-1 select-none">
                {group.name}
              </h3>
              {group.chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group allow-context-menu flex items-center relative text-sm text-neutral-800 dark:text-neutral-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${chat.id === currentChatId
                    ? "bg-neutral-100 text-black dark:bg-neutral-800"
                    : ""
                    }`}
                  onMouseEnter={() => handleMouseEnter(chat.id)}
                  onContextMenu={(e) =>
                    handleContextMenu(
                      e,
                      chat.id,
                      chat.title ||
                      chat.userExcerpt ||
                      chat.createdAt.toLocaleString(),
                    )
                  }
                >
                  {editingChatId === chat.id ? (
                    <div className="flex-1 flex items-center min-w-0 px-2 py-2 bg-neutral-100 text-black dark:bg-neutral-800 rounded-lg">
                      <span className="truncate font-sans text-sm w-full">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveRename();
                            } else if (e.key === "Escape") {
                              setEditingChatId(null);
                              setEditValue("");
                            }
                          }}
                          className="bg-transparent border-0 focus:outline-none w-full dark:text-white"
                          style={{
                            font: "inherit",
                            lineHeight: "inherit",
                            padding: 0,
                            margin: 0,
                          }}
                        />
                      </span>
                    </div>
                  ) : (
                    <>
                      <Link
                        to="/c/$chatId"
                        params={{ chatId: chat.id }}
                        className="flex-1 flex items-center min-w-0 px-2 py-2 select-none"
                        onClick={(e) => {
                          handleShiftClick(e, chat.id);
                          setMenuOpenChatId(null);
                        }}
                        draggable={false}
                      >
                        <span className="truncate font-sans text-sm">
                          {chat.title ||
                            chat.userExcerpt ||
                            chat.createdAt.toLocaleString()}
                          {streamingChatIds.has(chat.id) && (
                            <svg className="ml-2 inline-block h-3 w-3 animate-spin text-neutral-400 dark:text-neutral-500" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          )}
                        </span>
                        {copiedChatId === chat.id && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                            Copied!
                          </span>
                        )}
                      </Link>
                      <div
                        ref={menuOpenChatId === chat.id ? menuRef : undefined}
                        data-menu-open={menuOpenChatId === chat.id ? "true" : undefined}
                        className={`relative flex-shrink-0 ${menuOpenChatId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id);
                          }}
                          className="p-1 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                          title="More actions"
                          aria-label={`Actions for ${chat.title || "chat"}`}
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>
                        {menuOpenChatId === chat.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1 origin-top-right"
                          >
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                startEditing(chat.id, chat.title || "");
                                setMenuOpenChatId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleExportChat(chat.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              Export
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPendingDeleteId(chat.id);
                                setPendingDeleteTitle(chat.title || "");
                                setMenuOpenChatId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer border-t border-neutral-200 dark:border-neutral-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete chat?"
        message={
          pendingDeleteTitle
            ? `Are you sure you want to delete "${pendingDeleteTitle}"? This cannot be undone.`
            : "Are you sure you want to delete this chat? This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDeleteChat}
        onCancel={() => {
          setPendingDeleteId(null);
          setPendingDeleteTitle("");
        }}
      />
    </nav>
  );
}
