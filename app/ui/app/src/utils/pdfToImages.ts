/**
 * Converts a PDF file (as Uint8Array) to an array of PNG page images.
 * Uses pdf.js (pdfjs-dist) with the bundled worker, so it works offline.
 */

// Use the legacy build for maximum webview compatibility
// @ts-ignore - legacy build ships its own types via pdf.d.mts
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-ignore - Vite ?url import returns the bundled worker URL (works offline)
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfToImagesOptions {
  scale?: number;
  onProgress?: (page: number, total: number) => void;
}

export interface PdfPageImage {
  /** PNG bytes */
  data: Uint8Array;
  page: number;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function pdfToImages(
  data: Uint8Array,
  options: PdfToImagesOptions = {},
): Promise<PdfPageImage[]> {
  const { scale = 2, onProgress } = options;

  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  const images: PdfPageImage[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvas, viewport }).promise;
      images.push({
        data: dataUrlToBytes(canvas.toDataURL("image/png")),
        page: i,
      });

      onProgress?.(i, doc.numPages);
    }
  } finally {
    loadingTask.destroy();
  }

  return images;
}
