import type { Annotation } from '@/types';

export const TEXT_FONT_FAMILY =
  "system-ui, -apple-system, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif";

export const LINE_HEIGHT = 1.32;
const BASELINE = 0.82; // フォント上端からベースラインまでの概算比率

function pointsAttr(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/** 矢印の先端ポリゴンの頂点を計算する。 */
function arrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(8, strokeWidth * 3.2);
  const spread = Math.PI / 7;
  const ax = x2 - len * Math.cos(angle - spread);
  const ay = y2 - len * Math.sin(angle - spread);
  const bx = x2 - len * Math.cos(angle + spread);
  const by = y2 - len * Math.sin(angle + spread);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

/**
 * 1つの注釈をSVG要素として描く純粋関数コンポーネント。
 * 画面表示のオーバーレイと、書き出し時のラスタライズ（renderToStaticMarkup）で
 * 同じものを使うため、見た目が完全に一致する。座標はすべてPDFポイント。
 */
export function AnnotationShape({ annotation: a }: { annotation: Annotation }) {
  switch (a.type) {
    case 'pen':
      return (
        <polyline
          points={pointsAttr(a.points)}
          fill="none"
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          strokeOpacity={a.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'highlight':
      return (
        <polyline
          points={pointsAttr(a.points)}
          fill="none"
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          strokeOpacity={a.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'rect':
      return (
        <rect
          x={Math.min(a.x, a.x + a.w)}
          y={Math.min(a.y, a.y + a.h)}
          width={Math.abs(a.w)}
          height={Math.abs(a.h)}
          fill={a.fill ?? 'none'}
          fillOpacity={a.fill ? a.opacity * 0.7 : 0}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          strokeOpacity={a.opacity}
        />
      );

    case 'ellipse': {
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={Math.abs(a.w / 2)}
          ry={Math.abs(a.h / 2)}
          fill={a.fill ?? 'none'}
          fillOpacity={a.fill ? a.opacity * 0.7 : 0}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          strokeOpacity={a.opacity}
        />
      );
    }

    case 'line':
      return (
        <line
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke={a.color}
          strokeWidth={a.strokeWidth}
          strokeOpacity={a.opacity}
          strokeLinecap="round"
        />
      );

    case 'arrow':
      return (
        <g stroke={a.color} strokeOpacity={a.opacity} fill={a.color} fillOpacity={a.opacity}>
          <line
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            strokeWidth={a.strokeWidth}
            strokeLinecap="round"
          />
          <polygon
            points={arrowHead(a.x1, a.y1, a.x2, a.y2, a.strokeWidth)}
            strokeWidth={0}
            strokeLinejoin="round"
          />
        </g>
      );

    case 'text': {
      const lines = a.text.split('\n');
      return (
        <text
          fontFamily={TEXT_FONT_FAMILY}
          fontSize={a.fontSize}
          fill={a.color}
          fillOpacity={a.opacity}
          style={{ whiteSpace: 'pre' }}
        >
          {lines.map((ln, i) => (
            <tspan
              key={i}
              x={a.x}
              y={a.y + a.fontSize * BASELINE + i * a.fontSize * LINE_HEIGHT}
            >
              {ln.length ? ln : ' '}
            </tspan>
          ))}
        </text>
      );
    }

    case 'image':
      return (
        <image
          href={a.dataUrl}
          x={a.x}
          y={a.y}
          width={a.w}
          height={a.h}
          opacity={a.opacity}
          preserveAspectRatio="none"
        />
      );

    default:
      return null;
  }
}
