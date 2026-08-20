import { Model } from "@/gotypes";
// Shared file validation logic used by both FileUpload and native dialog selection

export const TEXT_FILE_EXTENSIONS = [
  "pdf",
  "docx",
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "cpp",
  "c",
  "cc",
  "h",
  "cs",
  "php",
  "rb",
  "go",
  "rs",
  "swift",
  "kt",
  "scala",
  "sh",
  "bat",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
  "rtf",
];

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const AUDIO_EXTENSIONS = ["wav", "mp3", "ogg"];

export interface FileValidationOptions {
  maxFileSize?: number; // in MB
  allowedExtensions?: string[];
  hasVisionCapability?: boolean;
  hasAudioCapability?: boolean;
  selectedModel?: Model | null;
  /** When true, PDF files are rendered to per-page PNG images instead of being sent for text extraction */
  pdfAsImages?: boolean;
  customValidator?: (file: File) => { valid: boolean; error?: string };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {},
): ValidationResult {
  const {
    maxFileSize = 10,
    allowedExtensions = [...TEXT_FILE_EXTENSIONS, ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS],
    customValidator,
  } = options;

  const MAX_FILE_SIZE = maxFileSize * 1024 * 1024; // Convert MB to bytes
  const fileExtension = file.name.toLowerCase().split(".").pop();

  // Custom validation first
  if (customValidator) {
    const customResult = customValidator(file);
    if (!customResult.valid) {
      return customResult;
    }
  }

  // File extension validation
  if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: "File type not supported" };
  }

  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large" };
  }

  return { valid: true };
}

// Helper function to read file as Uint8Array
export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Process multiple files with validation
export async function processFiles(
  files: File[],
  options: FileValidationOptions = {},
): Promise<{
  validFiles: Array<{ filename: string; data: Uint8Array; type?: string }>;
  errors: Array<{ filename: string; error: string }>;
}> {
  const validFiles: Array<{
    filename: string;
    data: Uint8Array;
    type?: string;
  }> = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const file of files) {
    const validation = validateFile(file, options);

    if (!validation.valid) {
      errors.push({
        filename: file.name,
        error: validation.error || "File validation failed",
      });
      continue;
    }

    try {
      const fileBytes = await readFileAsBytes(file);

      // PDF as images mode: render each page to a PNG so vision models can read it
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      if (options.pdfAsImages && isPdf) {
        if (!options.hasVisionCapability) {
          errors.push({
            filename: file.name,
            error: "PDF as images requires a vision model",
          });
          continue;
        }
        try {
          const { pdfToImages } = await import("@/utils/pdfToImages");
          const pages = await pdfToImages(fileBytes);
          const baseName = file.name.replace(/\.pdf$/i, "");
          for (const page of pages) {
            validFiles.push({
              filename: `${baseName}-page${page.page}.png`,
              data: page.data,
              type: "image/png",
            });
          }
        } catch (err) {
          console.error(`Error converting PDF ${file.name} to images:`, err);
          errors.push({
            filename: file.name,
            error: "Failed to render PDF as images",
          });
        }
        continue;
      }

      validFiles.push({
        filename: file.name,
        data: fileBytes,
        type: file.type || undefined,
      });
    } catch (error) {
      console.error(`Error reading file ${file.name}:`, error);
      errors.push({
        filename: file.name,
        error: "Error reading file",
      });
    }
  }

  return { validFiles, errors };
}
