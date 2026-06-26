import type { Annotation } from '@/types';
import { LINE_HEIGHT, TEXT_FONT_FAMILY } from '@/components/AnnotationShape';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
}

export function measureTextWidth(text: string, fontSize: number): number {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
  let max = 0;
  for (const line of text.split('\n')) {
    max = Math.max(max, ctx.measureText(line || ' ').width);
  }
  return max;
}

export function textBox(text: string, fontSize: number, x: number, y: number): Rect {
  const lines = text.split('\n');
  return {
    x,
    y,
    w: Math.max(measureTextWidth(text, fontSize), fontSize * 0.6),
    h: lines.length * fontSize * LINE_HEIGHT,
  };
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
    case 'text':
      return textBox(a.text, a.fontSize, a.x, a.y);
    case 'image':
      return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}
