import { useState, useRef, useEffect } from "react";

interface SystemPromptButtonProps {
  isVisible?: boolean;
  systemMessage?: string;
  onSystemMessageChange?: (message: string) => void;
}

export function SystemPromptButton({ isVisible, systemMessage, onSystemMessageChange }: SystemPromptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState(systemMessage || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessage(systemMessage || "");
  }, [systemMessage]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        title="System prompt"
        onClick={() => setIsOpen(!isOpen)}
        className={`select-none flex items-center justify-center rounded-full h-9 w-9 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer transition-all whitespace-nowrap border border-transparent ${
          systemMessage
            ? "text-amber-600 dark:text-amber-400"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        <svg className="w-4 flex-none fill-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 8H2" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[280px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-3">
          <div className="mb-2">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">System Prompt</label>
          </div>
          <textarea
            value={localMessage}
            onChange={(e) => setLocalMessage(e.target.value)}
            onBlur={() => onSystemMessageChange?.(localMessage)}
            className="w-full h-24 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm text-neutral-900 dark:text-neutral-100 resize-none"
            placeholder="You are a helpful assistant..."
            autoFocus
          />
          <div className="flex justify-end mt-2 gap-2">
            <button
              onClick={() => {
                setLocalMessage("");
                onSystemMessageChange?.("");
                setIsOpen(false);
              }}
              className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
            <button
              onClick={() => {
                onSystemMessageChange?.(localMessage);
                setIsOpen(false);
              }}
              className="px-3 py-1 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
