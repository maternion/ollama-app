import { forwardRef, useState, useRef, useEffect } from "react";
import { Lightbulb, LightbulbOff, Check } from "lucide-react";
import type { ThinkingLevel } from "./ChatForm";

const THINKING_LEVELS = {
  OFF: "off",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  MAX: "max",
} as const;

const THINKING_LEVEL_LABELS = {
  off: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
} as const;

interface ThinkButtonProps {
  mode: "think" | "thinkingLevel";
  isVisible?: boolean;
  isActive?: boolean;
  currentLevel?: ThinkingLevel;
  onToggle?: () => void;
  onLevelChange?: (level: ThinkingLevel) => void;
  onDropdownToggle?: (isOpen: boolean) => void;
}

export const ThinkButton = forwardRef<HTMLButtonElement, ThinkButtonProps>(
  function ThinkButton(
    {
      mode,
      isVisible,
      isActive,
      currentLevel,
      onToggle,
      onLevelChange,
      onDropdownToggle,
    },
    ref,
  ) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (
        ref &&
        typeof ref === "object" &&
        ref.current &&
        mode === "thinkingLevel"
      ) {
        (ref.current as any).closeDropdown = () => setIsDropdownOpen(false);
      }
    }, [ref, mode]);

    useEffect(() => {
      if (mode !== "thinkingLevel" || !isDropdownOpen) return;

      function handleClickOutside(event: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsDropdownOpen(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isDropdownOpen, mode]);

    if (!isVisible) return null;

    if (mode === "think") {
      return (
        <button
          ref={ref}
          title={isActive ? "Disable think mode" : "Enable think mode"}
          onClick={onToggle}
          className={`select-none flex items-center justify-center rounded-full h-9 w-9 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all whitespace-nowrap border border-transparent ${
            isActive
              ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)]"
              : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          {isActive ? (
            <Lightbulb className="w-4 h-4 text-amber-400" />
          ) : (
            <LightbulbOff className="w-4 h-4" />
          )}
        </button>
      );
    }

    // thinkingLevel mode
    const displayLabel = currentLevel
      ? THINKING_LEVEL_LABELS[currentLevel]
      : "";
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          ref={ref}
          title={`Thinking level: ${displayLabel}`}
          onClick={() => {
            const newState = !isDropdownOpen;
            setIsDropdownOpen(newState);
            onDropdownToggle?.(newState);
          }}
          className={`select-none flex items-center justify-center gap-1 rounded-full h-9 px-3 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all whitespace-nowrap border border-transparent text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)]`}
        >
          <div className="justify-center items-center flex space-x-2">
            <Lightbulb className={`w-3 flex-none ${currentLevel && currentLevel !== "off" ? "text-amber-400" : "text-current"}`} />
            <span className="text-sm">{displayLabel}</span>
          </div>
          <svg
            className={`w-3 h-3`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute bottom-full mb-2 text-[15px] rounded-2xl overflow-hidden bg-white border border-neutral-100 text-neutral-800 shadow-xl shadow-black/5 backdrop-blur-lg dark:border-neutral-600/40 dark:bg-neutral-800 dark:text-white dark:ring-black/20 min-w-[120px]">
            {Object.entries(THINKING_LEVELS).map(([, level]) => (
              <button
                key={level}
                className={`w-full flex items-center text-left px-3 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300 ${
                  currentLevel === level
                    ? "bg-neutral-100 dark:bg-neutral-700/60"
                    : ""
                }`}
                onClick={() => {
                  onLevelChange?.(level);
                  setIsDropdownOpen(false);
                }}
              >
                {THINKING_LEVEL_LABELS[level]}
                {currentLevel === level && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
