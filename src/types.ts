// 注釈の座標系はすべて「PDFポイント・表示空間（左上原点・y下向き）」で保持する。
// pdf.js の viewport(scale=1) の幅・高さと一致する空間なので、画面表示は
// この座標に displayScale を掛けるだけ、書き出しは export.ts でPDFへ変換する。

export type Tool =
  | 'select'
  | 'text'
  | 'pen'
  | 'highlight'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'image';

export interface Point {
  x: number;
  y: number;
}

interface BaseAnnotation {
  id: string;
  page: number; // 0-based
  color: string; // #rrggbb
  opacity: number; // 0..1
}

/** ペン・ハイライト（自由曲線） */
export interface PathAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlight';
  points: Point[];
  strokeWidth: number;
}

/** 四角・楕円 */
export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
  strokeWidth: number;
  fill: string | null; // 塗りなしは null
}

/** 直線・矢印 */
export interface LineAnnotation extends BaseAnnotation {
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

/** テキスト（PowerPoint風のテキストボックス。w の幅で自動折り返し、高さは内容に追従） */
export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number; // ボックスの左上
  w: number; // ボックス幅（この幅で折り返す）
  text: string;
  fontSize: number;
  fontFamily: string;
}

/** 画像・サイン */
export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string;
}

export type Annotation =
  | PathAnnotation
  | ShapeAnnotation
  | LineAnnotation
  | TextAnnotation
  | ImageAnnotation;

export interface ToolSettings {
  color: string;
  fillEnabled: boolean;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  highlightColor: string;
}

export interface PageInfo {
  index: number;
  width: number; // PDFポイント（回転考慮後の表示サイズ）
  height: number;
}
