import { PDFDocument, degrees } from 'pdf-lib';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Annotation, PageInfo } from '@/types';
import { AnnotationShape } from '@/components/AnnotationShape';

const EXPORT_SCALE = 2; // ラスタライズ解像度（高いほど鮮明・ファイル大）

/** 注釈レイヤー(SVG文字列)を PNG バイト列にラスタライズする。 */
async function svgToPng(svg: string, pxW: number, pxH: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('注釈レイヤーの描画に失敗しました'));
      im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(pxW));
    canvas.height = Math.max(1, Math.round(pxH));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas を初期化できませんでした');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG生成に失敗しました'))), 'image/png'),
    );
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderLayerSvg(anns: Annotation[], W: number, H: number): string {
  return renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W * EXPORT_SCALE}
      height={H * EXPORT_SCALE}
      viewBox={`0 0 ${W} ${H}`}
    >
      {anns.map((a) => (
        <AnnotationShape key={a.id} annotation={a} />
      ))}
    </svg>,
  );
}

/**
 * 元PDFに注釈を焼き込んだ新しいPDFのバイト列を返す。
 * 注釈は表示空間(左上原点)のSVGをラスタライズしたものを、ページの /Rotate を
 * 打ち消すように配置して全面に重ねる。
 */
export async function exportAnnotatedPdf(
  originalBytes: Uint8Array,
  annotations: Annotation[],
  pages: PageInfo[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pageList = pdfDoc.getPages();

  const byPage = new Map<number, Annotation[]>();
  for (const a of annotations) {
    if (!byPage.has(a.page)) byPage.set(a.page, []);
    byPage.get(a.page)!.push(a);
  }

  for (const [pageIndex, anns] of byPage) {
    if (anns.length === 0) continue;
    const info = pages[pageIndex];
    const page = pageList[pageIndex];
    if (!info || !page) continue;

    // 表示空間サイズ（回転考慮後）
    const W = info.width;
    const H = info.height;

    const svg = renderLayerSvg(anns, W, H);
    const png = await svgToPng(svg, W * EXPORT_SCALE, H * EXPORT_SCALE);
    const image = await pdfDoc.embedPng(png);

    const rot = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const { width: w, height: h } = page.getSize(); // 回転前のメディアボックス

    // ページの /Rotate（時計回り）を打ち消すように、レイヤー画像を反時計回りに配置する。
    switch (rot) {
      case 90:
        page.drawImage(image, { x: w, y: 0, width: h, height: w, rotate: degrees(90) });
        break;
      case 180:
        page.drawImage(image, { x: w, y: h, width: w, height: h, rotate: degrees(180) });
        break;
      case 270:
        page.drawImage(image, { x: 0, y: h, width: h, height: w, rotate: degrees(270) });
        break;
      default:
        page.drawImage(image, { x: 0, y: 0, width: w, height: h });
    }
  }

  return pdfDoc.save();
}

/** Uint8Array を PDF ファイルとしてダウンロードさせる。 */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
