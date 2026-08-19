import { forwardRef } from "react";
import { Globe } from "lucide-react";

interface ButtonProps {
  isVisible?: boolean;
  isActive: boolean;
  onToggle: () => void;
}

export const WebSearchButton = forwardRef<HTMLButtonElement, ButtonProps>(
  function WebSearchButton({ isVisible, isActive, onToggle }, ref) {
    if (!isVisible) return null;

    return (
      <button
        ref={ref}
        title={isActive ? "Disable web search" : "Enable web search"}
        onClick={onToggle}
        className={`select-none flex items-center justify-center rounded-full h-9 w-9 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all whitespace-nowrap border border-transparent ${
          isActive
            ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)]"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        <Globe className="h-5 w-5" />
      </button>
    );
  },
);
