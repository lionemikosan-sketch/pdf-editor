import { useEffect, useMemo, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import type { Annotation, PageInfo, Point } from '@/types';
import { useStore } from '@/store/useStore';
import { AnnotationShape } from './AnnotationShape';
import { bboxOf } from '@/lib/geometry';
import { uid } from '@/lib/id';

interface Props {
  info: PageInfo;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'p1' | 'p2';

interface Interaction {
  kind: 'create' | 'move' | 'resize';
  id: string;
  handle?: ResizeHandle;
  start: Point;
  original?: Annotation;
}

interface EditorState {
  mode: 'new' | 'edit';
  id?: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  value: string;
}

const HANDLE_PX = 9;
const MIN_SIZE = 8;

function translate(a: Annotation, dx: number, dy: number): Annotation {
  switch (a.type) {
    case 'pen':
    case 'highlight':
      return { ...a, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'line':
    case 'arrow':
      return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
    default:
      return { ...a, x: a.x + dx, y: a.y + dy };
  }
}

export function PageView({ info }: Props) {
  const pageIndex = info.index;
  const doc = useStore((s) => s.doc);
  const scale = useStore((s) => s.displayScale);
  const tool = useStore((s) => s.tool);
  const settings = useStore((s) => s.settings);
  const allAnnotations = useStore((s) => s.annotations);
  const selectedId = useStore((s) => s.selectedId);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const select = useStore((s) => s.select);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  // draft の正本は ref に持つ（同一ジェスチャ内で再レンダリングを待たずに確定できるように）。
  const draftRef = useRef<Annotation | null>(null);

  const [draft, setDraftState] = useState<Annotation | null>(null);
  const [editor, setEditorState] = useState<EditorState | null>(null);
  const editorRef = useRef<EditorState | null>(null);

  function setDraft(next: Annotation | null) {
    draftRef.current = next;
    setDraftState(next);
  }

  function setEditor(next: EditorState | null) {
    editorRef.current = next;
    setEditorState(next);
  }

  const W = info.width;
  const H = info.height;
  const cssW = Math.round(W * scale);
  const cssH = Math.round(H * scale);

  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.page === pageIndex),
    [allAnnotations, pageIndex],
  );

  // ---- PDFページの描画（スケール変更・ページ変更時に再描画） ----
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        /* レンダリングのキャンセルは無視 */
      }
      page.cleanup();
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageIndex, scale]);

  // ツール変更時は編集テキストを確定して閉じる
  useEffect(() => {
    if (tool !== 'text' && tool !== 'select') commitEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  function getPoint(e: React.PointerEvent): Point {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W, (e.clientX - rect.left) / scale)),
      y: Math.max(0, Math.min(H, (e.clientY - rect.top) / scale)),
    };
  }

  function capturePointer(pointerId: number) {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      /* 合成イベント等でキャプチャできない場合は無視 */
    }
  }

  function commitEditor() {
    const ed = editorRef.current;
    if (!ed) return;
    // 先に編集状態を閉じる（アンマウント時の blur 等による二重確定を防ぐ）
    setEditor(null);
    const value = ed.value.replace(/\s+$/, '');
    if (ed.mode === 'new') {
      if (value.trim().length > 0) {
        addAnnotation({
          id: uid('t'),
          page: pageIndex,
          type: 'text',
          x: ed.x,
          y: ed.y,
          text: value,
          fontSize: ed.fontSize,
          color: ed.color,
          opacity: 1,
        });
      }
    } else if (ed.id) {
      if (value.trim().length === 0) deleteAnnotation(ed.id);
      else updateAnnotation(ed.id, { text: value } as Partial<Annotation>);
    }
  }

  // ---- ポインタ操作 ----
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const pt = getPoint(e);
    const targetEl = e.target as Element;
    const handle = targetEl.getAttribute('data-handle') as ResizeHandle | null;
    const hitId = targetEl.closest('[data-aid]')?.getAttribute('data-aid') ?? null;

    if (editor) commitEditor();

    if (tool === 'select') {
      if (handle && selectedId) {
        const original = annotations.find((a) => a.id === selectedId);
        if (original) {
          interactionRef.current = { kind: 'resize', id: selectedId, handle, start: pt, original };
          setDraft(original);
          capturePointer(e.pointerId);
        }
        return;
      }
      if (hitId) {
        select(hitId);
        const original = annotations.find((a) => a.id === hitId);
        if (original) {
          interactionRef.current = { kind: 'move', id: hitId, start: pt, original };
          setDraft(original);
          capturePointer(e.pointerId);
        }
        return;
      }
      select(null);
      return;
    }

    if (tool === 'text') {
      setEditor({
        mode: 'new',
        x: pt.x,
        y: pt.y,
        fontSize: settings.fontSize,
        color: settings.color,
        value: '',
      });
      return;
    }

    // 描画系ツール
    const id = uid(tool);
    let ann: Annotation;
    if (tool === 'pen') {
      ann = { id, page: pageIndex, type: 'pen', points: [pt], strokeWidth: settings.strokeWidth, color: settings.color, opacity: 1 };
    } else if (tool === 'highlight') {
      ann = {
        id,
        page: pageIndex,
        type: 'highlight',
        points: [pt],
        strokeWidth: Math.max(settings.strokeWidth * 4, 14),
        color: settings.highlightColor,
        opacity: 0.4,
      };
    } else if (tool === 'rect' || tool === 'ellipse') {
      ann = {
        id,
        page: pageIndex,
        type: tool,
        x: pt.x,
        y: pt.y,
        w: 0,
        h: 0,
        strokeWidth: settings.strokeWidth,
        color: settings.color,
        opacity: 1,
        fill: settings.fillEnabled ? settings.fillColor : null,
      };
    } else if (tool === 'line' || tool === 'arrow') {
      ann = {
        id,
        page: pageIndex,
        type: tool,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
        strokeWidth: settings.strokeWidth,
        color: settings.color,
        opacity: 1,
      };
    } else {
      return;
    }
    interactionRef.current = { kind: 'create', id, start: pt };
    setDraft(ann);
    capturePointer(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const it = interactionRef.current;
    if (!it) return;
    const pt = getPoint(e);

    if (it.kind === 'create') {
      const d = draftRef.current;
      if (!d) return;
      if (d.type === 'pen' || d.type === 'highlight') {
        const last = d.points[d.points.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) return;
        setDraft({ ...d, points: [...d.points, pt] });
      } else if (d.type === 'line' || d.type === 'arrow') {
        setDraft({ ...d, x2: pt.x, y2: pt.y });
      } else if (d.type === 'rect' || d.type === 'ellipse') {
        setDraft({ ...d, w: pt.x - it.start.x, h: pt.y - it.start.y });
      }
      return;
    }

    if (it.kind === 'move' && it.original) {
      setDraft(translate(it.original, pt.x - it.start.x, pt.y - it.start.y));
      return;
    }

    if (it.kind === 'resize' && it.original && it.handle) {
      setDraft(resizeAnnotation(it.original, it.handle, pt));
    }
  }

  function onPointerUp() {
    const it = interactionRef.current;
    interactionRef.current = null;
    const d = draftRef.current;
    setDraft(null);
    if (!it || !d) return;

    if (it.kind === 'create') {
      if (d.type === 'pen' || d.type === 'highlight') {
        if (d.points.length > 1) addAnnotation(d);
      } else if (d.type === 'line' || d.type === 'arrow') {
        if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 3) addAnnotation(d);
      } else if (d.type === 'rect' || d.type === 'ellipse') {
        if (Math.abs(d.w) > 3 && Math.abs(d.h) > 3) {
          addAnnotation(normalizeShape(d));
        }
      }
      return;
    }

    // move / resize の確定
    updateAnnotation(it.id, d as Partial<Annotation>);
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (tool !== 'select') return;
    const hitId = (e.target as Element).closest('[data-aid]')?.getAttribute('data-aid');
    if (!hitId) return;
    const a = annotations.find((x) => x.id === hitId);
    if (a && a.type === 'text') {
      setEditor({ mode: 'edit', id: a.id, x: a.x, y: a.y, fontSize: a.fontSize, color: a.color, value: a.text });
      select(a.id);
    }
  }

  // 描画用：選択中で移動/リサイズ中なら draft を、テキスト編集中ならその注釈を差し替え/除外
  const renderList = annotations.map((a) => {
    if (draft && draft.id === a.id) return draft;
    return a;
  });
  const draftIsNew = draft && !annotations.some((a) => a.id === draft.id) ? draft : null;
  const editingId = editor?.mode === 'edit' ? editor.id : null;

  const selected = selectedId ? renderList.find((a) => a.id === selectedId) : null;
  const cursor =
    tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div className="relative shadow-panel" style={{ width: cssW, height: cssH }}>
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 bg-white"
        style={{ width: cssW, height: cssH }}
      />
      <svg
        ref={svgRef}
        className="absolute left-0 top-0 touch-none"
        width={cssW}
        height={cssH}
        viewBox={`0 0 ${W} ${H}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* 確定済み注釈（編集中テキストは隠す） */}
        {renderList.map((a) =>
          a.id === editingId ? null : (
            <g key={a.id} style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}>
              <AnnotationShape annotation={a} />
            </g>
          ),
        )}

        {/* 作成中の注釈プレビュー */}
        {draftIsNew && (
          <g style={{ pointerEvents: 'none' }}>
            <AnnotationShape annotation={draftIsNew} />
          </g>
        )}

        {/* 選択用ヒット領域（選択ツール時のみ・全バウンディングボックスをクリック可能に） */}
        {tool === 'select' &&
          renderList.map((a) => {
            if (a.id === editingId) return null;
            const b = bboxOf(a);
            return (
              <rect
                key={`hit-${a.id}`}
                data-aid={a.id}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="transparent"
                style={{ cursor: 'move' }}
              />
            );
          })}

        {/* 選択枠とハンドル */}
        {tool === 'select' && selected && (
          <SelectionOverlay annotation={selected} scale={scale} />
        )}
      </svg>

      {/* テキスト編集テキストエリア */}
      {editor && (
        <textarea
          className="text-editor"
          autoFocus
          placeholder="テキストを入力"
          value={editor.value}
          spellCheck={false}
          onChange={(e) => {
            const cur = editorRef.current;
            if (cur) setEditor({ ...cur, value: e.target.value });
          }}
          onBlur={commitEditor}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              commitEditor();
            }
            e.stopPropagation();
          }}
          style={{
            left: editor.x * scale,
            top: editor.y * scale,
            fontSize: editor.fontSize * scale,
            color: editor.color,
            caretColor: editor.color,
            minWidth: Math.max(editor.fontSize * scale * 5, 96),
            minHeight: editor.fontSize * scale * 1.32,
          }}
          ref={(el) => {
            if (el) {
              el.style.width = '0px';
              el.style.height = '0px';
              el.style.width = `${el.scrollWidth + 2}px`;
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
        />
      )}
    </div>
  );
}

function resizeAnnotation(a: Annotation, handle: ResizeHandle, pt: Point): Annotation {
  if (a.type === 'line' || a.type === 'arrow') {
    if (handle === 'p1') return { ...a, x1: pt.x, y1: pt.y };
    if (handle === 'p2') return { ...a, x2: pt.x, y2: pt.y };
    return a;
  }
  if (a.type === 'rect' || a.type === 'ellipse' || a.type === 'image') {
    // 正規化された現在のボックス
    const x0 = Math.min(a.x, a.x + a.w);
    const y0 = Math.min(a.y, a.y + a.h);
    const x1 = x0 + Math.abs(a.w);
    const y1 = y0 + Math.abs(a.h);
    let nx0 = x0;
    let ny0 = y0;
    let nx1 = x1;
    let ny1 = y1;
    if (handle === 'nw') {
      nx0 = pt.x;
      ny0 = pt.y;
    } else if (handle === 'ne') {
      nx1 = pt.x;
      ny0 = pt.y;
    } else if (handle === 'sw') {
      nx0 = pt.x;
      ny1 = pt.y;
    } else if (handle === 'se') {
      nx1 = pt.x;
      ny1 = pt.y;
    }
    const x = Math.min(nx0, nx1);
    const y = Math.min(ny0, ny1);
    const w = Math.max(MIN_SIZE, Math.abs(nx1 - nx0));
    const h = Math.max(MIN_SIZE, Math.abs(ny1 - ny0));
    return { ...a, x, y, w, h };
  }
  return a;
}

function normalizeShape(a: Annotation): Annotation {
  if (a.type === 'rect' || a.type === 'ellipse') {
    return {
      ...a,
      x: Math.min(a.x, a.x + a.w),
      y: Math.min(a.y, a.y + a.h),
      w: Math.abs(a.w),
      h: Math.abs(a.h),
    };
  }
  return a;
}

function SelectionOverlay({ annotation, scale }: { annotation: Annotation; scale: number }) {
  const hs = HANDLE_PX / scale;
  const stroke = 1.2 / scale;
  const accent = '#5b8cff';

  const handles: { key: ResizeHandle; x: number; y: number }[] = [];
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    handles.push({ key: 'p1', x: annotation.x1, y: annotation.y1 });
    handles.push({ key: 'p2', x: annotation.x2, y: annotation.y2 });
  } else if (
    annotation.type === 'rect' ||
    annotation.type === 'ellipse' ||
    annotation.type === 'image'
  ) {
    const b = bboxOf(annotation);
    handles.push({ key: 'nw', x: b.x, y: b.y });
    handles.push({ key: 'ne', x: b.x + b.w, y: b.y });
    handles.push({ key: 'sw', x: b.x, y: b.y + b.h });
    handles.push({ key: 'se', x: b.x + b.w, y: b.y + b.h });
  }

  const b = bboxOf(annotation);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={b.x - stroke}
        y={b.y - stroke}
        width={b.w + stroke * 2}
        height={b.h + stroke * 2}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeDasharray={`${4 / scale} ${3 / scale}`}
      />
      {handles.map((hd) => (
        <rect
          key={hd.key}
          data-handle={hd.key}
          data-aid={annotation.id}
          x={hd.x - hs / 2}
          y={hd.y - hs / 2}
          width={hs}
          height={hs}
          fill="#fff"
          stroke={accent}
          strokeWidth={stroke}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        />
      ))}
    </g>
  );
}
