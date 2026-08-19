/**
 * Converts a PDF file (as Uint8Array) to an array of base64 PNG data URLs.
 * Uses pdf.js to render each page to a canvas.
 *
 * Note: This requires the `pdfjs-dist` npm package.
 * Install with: npm install pdfjs-dist
 */

// Lazy-load pdf.js to avoid bundling issues if not installed
let pdfjsLib: any = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  try {
    // @ts-ignore - pdfjs-dist is an optional dependency
    pdfjsLib = await import("pdfjs-dist");
    // Set worker path — use CDN as fallback if local path doesn't work
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.worker.min.mjs";
    } catch {
      // Worker configuration is optional; pdf.js can run without it
    }
  } catch (e) {
    console.error("Failed to load pdf.js. Install with: npm install pdfjs-dist", e);
    throw new Error("PDF rendering requires pdfjs-dist package");
  }
  return pdfjsLib;
}

export interface PdfToImagesOptions {
  scale?: number;
  onProgress?: (page: number, total: number) => void;
}

export async function pdfToImages(
  data: Uint8Array,
  options: PdfToImagesOptions = {},
): Promise<string[]> {
  const { scale = 2, onProgress } = options;
  const lib = await loadPdfJs();

  const doc = await lib.getDocument({ data }).promise;
  const images: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/png"));

    onProgress?.(i, doc.numPages);
  }

  return images;
}