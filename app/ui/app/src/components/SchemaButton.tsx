import { useState, useRef, useEffect } from "react";
import { Braces } from "lucide-react";

interface SchemaButtonProps {
  isVisible?: boolean;
  isActive?: boolean;
  schema?: string;
  onSchemaChange?: (schema: string) => void;
  onToggle?: () => void;
}

export function SchemaButton({ isVisible, isActive, schema, onSchemaChange, onToggle }: SchemaButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSchema, setLocalSchema] = useState(schema || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSchema(schema || "");
  }, [schema]);

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
        title="JSON schema constrained generation"
        onClick={() => {
          if (!isActive && onToggle) onToggle();
          setIsOpen(!isOpen);
        }}
        className={`select-none flex items-center justify-center rounded-full h-9 px-3 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all whitespace-nowrap border border-transparent ${
          isActive
            ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)]"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        <Braces className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[320px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-3">
          <div className="mb-2">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">JSON Schema</label>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Constrains the model output to match this schema. Leave empty for unconstrained output.
            </p>
          </div>
          <textarea
            value={localSchema}
            onChange={(e) => setLocalSchema(e.target.value)}
            className="w-full h-40 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 resize-none"
            placeholder='{"type": "object", "properties": {"name": {"type": "string"}}}'
          />
          <div className="flex justify-end mt-2 gap-2">
            <button
              onClick={() => {
                setLocalSchema("");
                onSchemaChange?.("");
                onToggle?.();
                setIsOpen(false);
              }}
              className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
            <button
              onClick={() => {
                onSchemaChange?.(localSchema);
                setIsOpen(false);
              }}
              className="px-3 py-1 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
