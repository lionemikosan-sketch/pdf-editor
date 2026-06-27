// テキスト注釈の共有ロジック（行の高さ・フォント定義・テキスト計測・折り返し）。
// 画面表示(AnnotationShape) と 当たり判定(geometry) と 書き出し(export) で共有する。

export const LINE_HEIGHT = 1.35;
export const BASELINE = 0.86; // フォント上端からベースラインまでの概算比率

export interface FontOption {
  label: string;
  value: string; // CSS font-family スタック
}

// macOS 標準で利用できるフォントを中心に用意（書き出しはシステムフォントでラスタライズされる）。
export const FONT_OPTIONS: FontOption[] = [
  {
    label: 'ゴシック体',
    value:
      "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif",
  },
  {
    label: '明朝体',
    value: "'Hiragino Mincho ProN','YuMincho','Yu Mincho','Noto Serif JP',serif",
  },
  {
    label: '丸ゴシック',
    value: "'Hiragino Maru Gothic ProN','Hiragino Sans',sans-serif",
  },
  { label: 'Sans (英)', value: "Helvetica,Arial,sans-serif" },
  { label: 'Serif (英)', value: "'Times New Roman',Times,Georgia,serif" },
  { label: '等幅', value: "'SF Mono',Menlo,Consolas,'Courier New',monospace" },
];

export const DEFAULT_FONT = FONT_OPTIONS[0].value;

let measureCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

export function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const ctx = getCtx();
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/**
 * 指定幅で折り返した行の配列を返す。改行(\n)は明示的な改行として扱い、
 * 半角スペースのある箇所は単語単位、無い箇所（日本語など）は文字単位で折り返す。
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
): string[] {
  const ctx = getCtx();
  const limit = Math.max(maxWidth, fontSize * 0.6);
  const out: string[] = [];

  for (const para of text.split('\n')) {
    if (para.length === 0) {
      out.push('');
      continue;
    }
    if (!ctx) {
      out.push(para);
      continue;
    }
    ctx.font = `${fontSize}px ${fontFamily}`;
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (line === '' || ctx.measureText(test).width <= limit) {
        line = test;
      } else {
        const lastSpace = line.lastIndexOf(' ');
        if (lastSpace > 0 && ch !== ' ') {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
      }
    }
    out.push(line);
  }
  return out;
}

/** 折り返し後のテキストボックスの高さ（PDFポイント）。 */
export function textBoxHeight(lineCount: number, fontSize: number): number {
  return Math.max(1, lineCount) * fontSize * LINE_HEIGHT;
}
