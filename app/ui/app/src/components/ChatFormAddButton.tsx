import { useState, useRef, useEffect, forwardRef } from "react";
import {
  Plus,
  Lightbulb,
  LightbulbOff,
  Paperclip,
  Image,
  AudioLines,
  MessageSquare,
  Braces,
  Globe,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { processFiles } from "@/utils/fileValidation";
import { useSettings } from "@/hooks/useSettings";

const THINKING_LEVEL_LABELS: Record<string, string> = {
  off: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
};

const THINKING_LEVELS: string[] = ["off", "low", "medium", "high", "max"];

export interface ChatFormAddButtonProps {
  // Reasoning
  modelSupportsThinkingLevels: boolean;
  supportsThinkToggling: boolean;
  thinkEnabled: boolean;
  thinkLevel: string;
  onThinkLevelChange: (level: string) => void;
  onThinkToggle: () => void;

  // Web search
  webSearchEnabled: boolean;
  onWebSearchToggle: () => void;

  // System message
  systemMessage: string;
  onSystemMessageChange: (msg: string) => void;

  // JSON schema
  schemaActive: boolean;
  schema: string;
  onSchemaChange: (schema: string) => void;
  onSchemaToggle: () => void;
  // Cloud models don't support structured outputs
  isCloudModel: boolean;

  // File attachment
  onFileAttach: (
    files: Array<{ filename: string; data: Uint8Array; type?: string }>,
    errors: Array<{ filename: string; error: string }>,
  ) => void;
  hasVisionCapability: boolean;
  hasAudioCapability: boolean;

  // Visibility flags
  isVisible: boolean;
}

export const ChatFormAddButton = forwardRef<
  HTMLButtonElement,
  ChatFormAddButtonProps
>(function ChatFormAddButton(
  {
    modelSupportsThinkingLevels,
    supportsThinkToggling,
    thinkEnabled,
    thinkLevel,
    onThinkLevelChange,
    onThinkToggle,
    webSearchEnabled,
    onWebSearchToggle,
    systemMessage,
    onSystemMessageChange,
    schemaActive,
    schema,
    onSchemaChange,
    onSchemaToggle,
    isCloudModel,
    onFileAttach,
    hasVisionCapability,
    hasAudioCapability,
    isVisible,
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<
    "reasoning" | "system" | "schema" | null
  >(null);

  const [localSystemMessage, setLocalSystemMessage] = useState(systemMessage);
  const [localSchema, setLocalSchema] = useState(schema);

  // hasAudioCapability is passed in directly as a boolean prop
  const { settings: displaySettings } = useSettings();
  const pdfMode = (displaySettings as any)?.pdfMode ?? "text";

  useEffect(() => {
    setLocalSystemMessage(systemMessage);
  }, [systemMessage]);

  useEffect(() => {
    setLocalSchema(schema);
  }, [schema]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setExpandedSection(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Expose closeDropdown on the ref for external coordination
  useEffect(() => {
    if (ref && typeof ref === "object" && ref.current) {
      (ref.current as any).closeDropdown = () => {
        setIsOpen(false);
        setExpandedSection(null);
      };
    }
  }, [ref, isOpen]);

  if (!isVisible) return null;

  const showReasoning = modelSupportsThinkingLevels || supportsThinkToggling;
  const reasoningActive =
    modelSupportsThinkingLevels
      ? thinkLevel !== "off"
      : thinkEnabled;

  function dataURLToFile(dataURL: string, filename: string): File | null {
    try {
      const parts = dataURL.split(",");
      if (parts.length < 2) return null;
      const mimeType = parts[0].split(";")[0].split(":")[1];
      const binaryString = atob(parts[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++)
        bytes[i] = binaryString.charCodeAt(i);
      return new File([bytes], filename, { type: mimeType });
    } catch {
      return null;
    }
  }

  async function handlePickImages() {
    setIsOpen(false);
    setExpandedSection(null);
    const results = await window.webview?.selectImageFiles();
    if (!results || results.length === 0) return;
    const files = results
      .map((r) => dataURLToFile(r.dataURL, r.filename))
      .filter(Boolean) as File[];
    const { validFiles, errors } = await processFiles(files, {
      hasVisionCapability,
      hasAudioCapability,
      pdfAsImages: pdfMode === "images",
    });
    onFileAttach(validFiles, errors);
  }

  async function handlePickAudio() {
    setIsOpen(false);
    setExpandedSection(null);
    const result = await window.webview?.selectAudioFile();
    if (!result) return;
    const file = dataURLToFile(result.dataURL, result.filename);
    if (!file) return;
    const { validFiles, errors } = await processFiles([file], {
      hasVisionCapability,
      hasAudioCapability,
      pdfAsImages: pdfMode === "images",
    });
    onFileAttach(validFiles, errors);
  }

  async function handlePickFiles() {
    setIsOpen(false);
    setExpandedSection(null);
    const results = await window.webview?.selectMultipleFiles();
    if (!results || results.length === 0) return;
    const files = results
      .map((r) => dataURLToFile(r.dataURL, r.filename))
      .filter(Boolean) as File[];
    const { validFiles, errors } = await processFiles(files, {
      hasVisionCapability,
      hasAudioCapability,
      pdfAsImages: pdfMode === "images",
    });
    onFileAttach(validFiles, errors);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={ref}
        type="button"
        title="Add"
        onClick={() => setIsOpen(!isOpen)}
        className={`select-none flex items-center justify-center rounded-full h-9 w-9 bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all whitespace-nowrap border border-transparent ${
          isOpen
            ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)]"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        <Plus className="w-5 h-5" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[320px] max-w-[400px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl py-1">
          {/* Reasoning */}
          {showReasoning && (
            <>
              {modelSupportsThinkingLevels ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === "reasoning"
                          ? null
                          : "reasoning",
                      )
                    }
                    className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                      reasoningActive
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {reasoningActive ? (
                      <Lightbulb className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <LightbulbOff className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1">Reasoning</span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {THINKING_LEVEL_LABELS[thinkLevel] ?? ""}
                    </span>
                    {expandedSection === "reasoning" ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {expandedSection === "reasoning" && (
                    <div className="py-1 border-t border-neutral-100 dark:border-neutral-700">
                      {THINKING_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            onThinkLevelChange(level);
                            setExpandedSection(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 pl-9 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                            thinkLevel === level
                              ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          }`}
                        >
                          <span className="flex-1">
                            {THINKING_LEVEL_LABELS[level]}
                          </span>
                          {thinkLevel === level && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onThinkToggle();
                  }}
                  className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                    thinkEnabled
                      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  }`}
                >
                  {thinkEnabled ? (
                    <Lightbulb className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <LightbulbOff className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="flex-1">Reasoning</span>
                  {thinkEnabled && <Check className="w-3.5 h-3.5" />}
                </button>
              )}
            </>
          )}

          {/* Separator */}
          {showReasoning && (
            <div className="border-t border-neutral-100 dark:border-neutral-700 my-1" />
          )}

          {/* Files / Images / Audio — direct items */}
          <button
            type="button"
            onClick={handlePickFiles}
            className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer flex items-center gap-2 transition-colors"
          >
            <Paperclip className="w-4 h-4 flex-shrink-0" />
            Files
          </button>
          {hasVisionCapability && (
            <button
              type="button"
              onClick={handlePickImages}
              className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer flex items-center gap-2 transition-colors"
            >
              <Image className="w-4 h-4 flex-shrink-0" />
              Images
            </button>
          )}
          {hasAudioCapability && (
            <button
              type="button"
              onClick={handlePickAudio}
              className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer flex items-center gap-2 transition-colors"
            >
              <AudioLines className="w-4 h-4 flex-shrink-0" />
              Audio
            </button>
          )}
          {pdfMode === "images" && (
            <div className="px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 border-t border-neutral-100 dark:border-neutral-700 mt-1">
              PDFs: processing as images
            </div>
          )}

          {/* System Message — accordion */}
          <button
            type="button"
            onClick={() =>
              setExpandedSection(
                expandedSection === "system" ? null : "system",
              )
            }
            className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
              systemMessage
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">System message</span>
            {systemMessage && <Check className="w-3.5 h-3.5" />}
            {expandedSection === "system" ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedSection === "system" && (
            <div className="px-3 pb-2 border-t border-neutral-100 dark:border-neutral-700">
              <textarea
                value={localSystemMessage}
                onChange={(e) => setLocalSystemMessage(e.target.value)}
                onBlur={() => onSystemMessageChange(localSystemMessage)}
                className="w-full h-20 mt-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="You are a helpful assistant..."
                autoFocus
              />
              <div className="flex justify-end mt-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocalSystemMessage("");
                    onSystemMessageChange("");
                  }}
                  className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSystemMessageChange(localSystemMessage);
                    setExpandedSection(null);
                  }}
                  className="px-3 py-1 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* JSON Schema — accordion */}
          <button
            type="button"
            onClick={() => {
              if (isCloudModel) {
                setExpandedSection(
                  expandedSection === "schema" ? null : "schema",
                );
                return;
              }
              if (!schemaActive && !schema) {
                onSchemaToggle();
              }
              setExpandedSection(
                expandedSection === "schema" ? null : "schema",
              );
            }}
            className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
              isCloudModel
                ? "text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                : schemaActive && schema
                  ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)] bg-blue-50 dark:bg-blue-900/20"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            }`}
          >
            <Braces className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">JSON schema</span>
            {isCloudModel && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                Local only
              </span>
            )}
            {!isCloudModel && schemaActive && schema && <Check className="w-3.5 h-3.5" />}
            {expandedSection === "schema" ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedSection === "schema" && isCloudModel && (
            <div className="px-3 pb-2 border-t border-neutral-100 dark:border-neutral-700">
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Cloud models don't support structured outputs. Switch to a local model to use JSON schema.
              </p>
            </div>
          )}
          {expandedSection === "schema" && !isCloudModel && (
            <div className="px-3 pb-2 border-t border-neutral-100 dark:border-neutral-700">
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 mb-1">
                Constrains output to this schema. Leave empty for unconstrained output.
              </p>
              <textarea
                value={localSchema}
                onChange={(e) => setLocalSchema(e.target.value)}
                className="w-full h-32 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder='{"type": "object", "properties": {"name": {"type": "string"}}}'
                autoFocus
              />
              <div className="flex justify-end mt-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocalSchema("");
                    onSchemaChange("");
                    if (schemaActive) onSchemaToggle();
                    setExpandedSection(null);
                  }}
                  className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSchemaChange(localSchema);
                    setExpandedSection(null);
                  }}
                  className="px-3 py-1 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-100 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Web Search — toggle */}
          <button
            type="button"
            onClick={() => {
              onWebSearchToggle();
            }}
            className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
              webSearchEnabled
                ? "text-[rgba(0,115,255,1)] dark:text-[rgba(70,155,255,1)] bg-blue-50 dark:bg-blue-900/20"
                : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            }`}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Web search</span>
            {webSearchEnabled && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
});