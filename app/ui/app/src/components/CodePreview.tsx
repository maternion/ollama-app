import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

interface CodePreviewProps {
  open: boolean;
  code: string;
  language: string;
  onOpenChange: (open: boolean) => void;
}

export default function CodePreview({ open, code, language, onOpenChange }: CodePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    if (open) {
      iframeRef.current.srcdoc = code;
    } else {
      iframeRef.current.srcdoc = "";
    }
  }, [open, code]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100000]"
      onClick={() => onOpenChange(false)}
    >
      <iframe
        ref={iframeRef}
        title={`Preview ${language}`}
        sandbox="allow-scripts"
        className="fixed inset-0 w-dvw h-dvh border-0"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        className="absolute top-4 right-4 z-[100002] border-none bg-transparent text-white opacity-70 mix-blend-difference transition-opacity hover:opacity-100 cursor-pointer"
        aria-label="Close preview"
      >
        <XMarkIcon className="size-8" />
      </button>
    </div>
  );
}
