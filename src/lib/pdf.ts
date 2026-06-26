import * as pdfjsLib from 'pdfjs-dist';
// Vite: worker をURLとして取り込み GlobalWorkerOptions に渡す
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PageInfo } from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  pages: PageInfo[];
}

/**
 * バイト列からPDFを読み込み、各ページの表示サイズ（PDFポイント・回転考慮後）を返す。
 * pdf.js は data の ArrayBuffer を worker へ転送して detach する場合があるため、
 * 呼び出し側は元データを別に保持しておくこと（コピーを渡す）。
 */
export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const doc = await loadingTask.promise;
  const pages: PageInfo[] = [];
  for (let i = 0; i < doc.numPages; i += 1) {
    const page = await doc.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    pages.push({ index: i, width: vp.width, height: vp.height });
    page.cleanup();
  }
  return { doc, pages };
}

/**
 * 1ページを canvas に描画する。devicePixelRatio と displayScale を掛けて高精細に描く。
 * 返り値は描画に使った RenderTask（キャンセル用）。
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  displayScale: number,
): Promise<void> {
  const page: PDFPageProxy = await doc.getPage(pageIndex + 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: displayScale * dpr });
  const cssViewport = page.getViewport({ scale: displayScale });

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(cssViewport.width)}px`;
  canvas.style.height = `${Math.floor(cssViewport.height)}px`;

  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
}
