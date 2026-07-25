import { useRef, useEffect, useState } from "react";
import { processFiles } from "@/utils/fileValidation";
import { useHasAudioCapability } from "@/hooks/useModelCapabilities";

interface FileAttachmentMenuProps {
  onFilesReceived: (files: Array<{ filename: string; data: Uint8Array; type?: string }>, errors: Array<{ filename: string; error: string }>) => void;
  hasVisionCapability: boolean;
  selectedModel: string;
}

export function FileAttachmentMenu({ onFilesReceived, hasVisionCapability, selectedModel }: FileAttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasAudioCapability = useHasAudioCapability(selectedModel);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function dataURLToFile(dataURL: string, filename: string): File | null {
    try {
      const parts = dataURL.split(",");
      if (parts.length < 2) return null;
      const mimeType = parts[0].split(";")[0].split(":")[1];
      const binaryString = atob(parts[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return new File([bytes], filename, { type: mimeType });
    } catch {
      return null;
    }
  }

  async function handlePickAudio() {
    setOpen(false);
    const result = await window.webview?.selectAudioFile();
    if (!result) return;
    const file = dataURLToFile(result.dataURL, result.filename);
    if (!file) return;
    const { validFiles, errors } = await processFiles([file], {
      hasVisionCapability,
      hasAudioCapability,
    });
    onFilesReceived(validFiles, errors);
  }

  async function handlePickImages() {
    setOpen(false);
    const results = await window.webview?.selectImageFiles();
    if (!results || results.length === 0) return;
    const files = results
      .map((r) => dataURLToFile(r.dataURL, r.filename))
      .filter(Boolean) as File[];
    const { validFiles, errors } = await processFiles(files, {
      hasVisionCapability,
      hasAudioCapability,
    });
    onFilesReceived(validFiles, errors);
  }

  async function handlePickFiles() {
    setOpen(false);
    const results = await window.webview?.selectMultipleFiles();
    if (!results || results.length === 0) return;
    const files = results
      .map((r) => dataURLToFile(r.dataURL, r.filename))
      .filter(Boolean) as File[];
    const { validFiles, errors } = await processFiles(files, {
      hasVisionCapability,
      hasAudioCapability,
    });
    onFilesReceived(validFiles, errors);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer border border-transparent"
        title="Attach files"
      >
        <svg className="w-4.5 h-4.5 stroke-2 text-neutral-500 dark:text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-0.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px] z-50">
          {hasVisionCapability && (
            <button
              type="button"
              onClick={handlePickImages}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Images
            </button>
          )}
          <button
            type="button"
            onClick={handlePickFiles}
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Files
          </button>
          {hasAudioCapability && (
            <button
              type="button"
              onClick={handlePickAudio}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              Audio
            </button>
          )}
        </div>
      )}
    </div>
  );
}