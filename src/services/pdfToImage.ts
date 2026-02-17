/**
 * pdfToImage — Renders PDF pages to base64 PNG images.
 * Uses pdf.js (pdfjs-dist) to render in-browser via canvas.
 * 
 * Also provides text layer extraction with positions for faithful reproduction.
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use the local bundled worker (Vite resolves the ?url import)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ─── Types ─── */

export interface TextItem {
    text: string;
    x: number;      // percentage 0-100 from left
    y: number;      // percentage 0-100 from top
    fontSize: number;
    fontName: string;
    width: number;   // percentage of page width
}

export interface PageTextLayer {
    pageNumber: number;
    width: number;   // px at scale 1
    height: number;  // px at scale 1
    items: TextItem[];
}

/* ─── Single Page to Image (existing) ─── */

export async function pdfFirstPageToImage(
    pdfData: ArrayBuffer | Uint8Array,
    scale: number = 2.0
): Promise<{ base64: string; mimeType: string }> {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create canvas context');

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    canvas.width = 0;
    canvas.height = 0;

    return { base64, mimeType: 'image/png' };
}

/* ─── Multi-Page to Images (NEW) ─── */

export async function pdfAllPagesToImages(
    pdfData: ArrayBuffer | Uint8Array,
    scale: number = 2.5,
    maxPages: number = 5
): Promise<{ base64: string; mimeType: string; pageNumber: number }[]> {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const totalPages = Math.min(pdf.numPages, maxPages);
    const results: { base64: string; mimeType: string; pageNumber: number }[] = [];

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot create canvas context');

        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const dataUrl = canvas.toDataURL('image/png');
        results.push({
            base64: dataUrl.split(',')[1],
            mimeType: 'image/png',
            pageNumber: i,
        });

        canvas.width = 0;
        canvas.height = 0;
    }

    return results;
}

/* ─── Text Layer Extraction with Positions (NEW) ─── */

export async function pdfExtractTextWithPositions(
    pdfData: ArrayBuffer | Uint8Array,
    maxPages: number = 5
): Promise<PageTextLayer[]> {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const totalPages = Math.min(pdf.numPages, maxPages);
    const pages: PageTextLayer[] = [];

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        const items: TextItem[] = [];

        for (const item of textContent.items) {
            // Skip non-text items
            if (!('str' in item) || !item.str.trim()) continue;

            const textItem = item as any;
            // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
            const tx = textItem.transform[4];
            const ty = textItem.transform[5];
            const fontSize = Math.abs(textItem.transform[0]) || 12;
            const fontName = textItem.fontName || 'unknown';
            const textWidth = textItem.width || 0;

            // Convert to percentage coordinates (PDF origin is bottom-left)
            const xPct = (tx / viewport.width) * 100;
            const yPct = ((viewport.height - ty) / viewport.height) * 100;
            const widthPct = (textWidth / viewport.width) * 100;

            items.push({
                text: textItem.str,
                x: Math.round(xPct * 10) / 10,
                y: Math.round(yPct * 10) / 10,
                fontSize: Math.round(fontSize * 10) / 10,
                fontName,
                width: Math.round(widthPct * 10) / 10,
            });
        }

        pages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            items,
        });
    }

    return pages;
}

/* ─── Base64 convenience wrappers ─── */

export async function pdfBase64ToImage(pdfBase64: string, scale: number = 2.0): Promise<{ base64: string; mimeType: string }> {
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return pdfFirstPageToImage(bytes, scale);
}

export async function pdfBase64ToAllImages(pdfBase64: string, scale: number = 2.5, maxPages: number = 5) {
    const bytes = base64ToBytes(pdfBase64);
    return pdfAllPagesToImages(bytes, scale, maxPages);
}

export async function pdfBase64ExtractText(pdfBase64: string, maxPages: number = 5) {
    const bytes = base64ToBytes(pdfBase64);
    return pdfExtractTextWithPositions(bytes, maxPages);
}

function base64ToBytes(b64: string): Uint8Array {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
