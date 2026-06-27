import type { Annotation } from '@/types';
import { textBoxHeight, wrapText } from '@/lib/text';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 注釈の軸並行バウンディングボックス（PDFポイント）。選択枠・ハンドル描画用。 */
export function bboxOf(a: Annotation): Rect {
  switch (a.type) {
    case 'pen':
    case 'highlight': {
      const xs = a.points.map((p) => p.x);
      const ys = a.points.map((p) => p.y);
      const pad = a.strokeWidth / 2;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      return {
        x: minX,
        y: minY,
        w: Math.max(...xs) + pad - minX,
        h: Math.max(...ys) + pad - minY,
      };
    }
    case 'rect':
    case 'ellipse': {
      const x = Math.min(a.x, a.x + a.w);
      const y = Math.min(a.y, a.y + a.h);
      const pad = a.strokeWidth / 2;
      return { x: x - pad, y: y - pad, w: Math.abs(a.w) + a.strokeWidth, h: Math.abs(a.h) + a.strokeWidth };
    }
    case 'line':
    case 'arrow': {
      const pad = a.strokeWidth / 2 + 2;
      const minX = Math.min(a.x1, a.x2) - pad;
      const minY = Math.min(a.y1, a.y2) - pad;
      return {
        x: minX,
        y: minY,
        w: Math.abs(a.x2 - a.x1) + pad * 2,
        h: Math.abs(a.y2 - a.y1) + pad * 2,
      };
    }
    case 'text': {
      const lines = wrapText(a.text, a.w, a.fontSize, a.fontFamily);
      return { x: a.x, y: a.y, w: a.w, h: textBoxHeight(lines.length, a.fontSize) };
    }
    case 'image':
      return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}
