import { useRef } from 'react';
import {
  MousePointer2,
  Type,
  Pencil,
  Highlighter,
  Minus,
  MoveUpRight,
  Square,
  Circle,
  Image as ImageIcon,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Trash2,
  Download,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import type { Annotation, Tool } from '@/types';
import { useStore } from '@/store/useStore';
import { uid } from '@/lib/id';
import { FONT_OPTIONS } from '@/lib/text';

interface Props {
  onExport: () => void;
  onOpenClick: () => void;
}

const TOOLS: { tool: Tool; label: string; key: string; Icon: typeof Type }[] = [
  { tool: 'select', label: '選択 / 移動 (V)', key: 'V', Icon: MousePointer2 },
  { tool: 'text', label: 'テキスト (T)', key: 'T', Icon: Type },
  { tool: 'pen', label: 'ペン (P)', key: 'P', Icon: Pencil },
  { tool: 'highlight', label: 'ハイライト (H)', key: 'H', Icon: Highlighter },
  { tool: 'line', label: '直線 (L)', key: 'L', Icon: Minus },
  { tool: 'arrow', label: '矢印 (A)', key: 'A', Icon: MoveUpRight },
  { tool: 'rect', label: '四角形 (R)', key: 'R', Icon: Square },
  { tool: 'ellipse', label: '楕円 (O)', key: 'O', Icon: Circle },
];

function Divider() {
  return <div className="mx-1 h-7 w-px self-center bg-ink-600/70" />;
}

export function Toolbar({ onExport, onOpenClick }: Props) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const annotations = useStore((s) => s.annotations);
  const selectedId = useStore((s) => s.selectedId);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const scale = useStore((s) => s.displayScale);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const exporting = useStore((s) => s.exporting);
  const pages = useStore((s) => s.pages);
  const currentPage = useStore((s) => s.currentPage);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const selected = selectedId ? annotations.find((a) => a.id === selectedId) ?? null : null;

  const showFill =
    tool === 'rect' ||
    tool === 'ellipse' ||
    selected?.type === 'rect' ||
    selected?.type === 'ellipse';
  const showFont = tool === 'text' || selected?.type === 'text';
  const usingHighlight = tool === 'highlight' || selected?.type === 'highlight';
  const primaryColor = usingHighlight ? settings.highlightColor : settings.color;

  function applyToSelection(patch: Partial<Annotation>) {
    if (selected) updateAnnotation(selected.id, patch);
  }

  function onColorChange(value: string) {
    if (usingHighlight) {
      setSettings({ highlightColor: value });
      if (selected?.type === 'highlight') applyToSelection({ color: value });
    } else {
      setSettings({ color: value });
      if (selected && selected.type !== 'highlight') applyToSelection({ color: value });
    }
  }

  function onStrokeChange(value: number) {
    setSettings({ strokeWidth: value });
    if (
      selected &&
      (selected.type === 'pen' ||
        selected.type === 'line' ||
        selected.type === 'arrow' ||
        selected.type === 'rect' ||
        selected.type === 'ellipse')
    ) {
      applyToSelection({ strokeWidth: value });
    }
  }

  function onFontChange(value: number) {
    setSettings({ fontSize: value });
    if (selected?.type === 'text') applyToSelection({ fontSize: value });
  }

  function onFontFamilyChange(value: string) {
    setSettings({ fontFamily: value });
    if (selected?.type === 'text') applyToSelection({ fontFamily: value });
  }

  function onFillToggle(enabled: boolean) {
    setSettings({ fillEnabled: enabled });
    if (selected?.type === 'rect' || selected?.type === 'ellipse') {
      applyToSelection({ fill: enabled ? settings.fillColor : null });
    }
  }

  function onFillColor(value: string) {
    setSettings({ fillColor: value });
    if ((selected?.type === 'rect' || selected?.type === 'ellipse') && settings.fillEnabled) {
      applyToSelection({ fill: value });
    }
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const info = pages[currentPage];
        if (!info) return;
        const maxW = info.width * 0.4;
        const ratio = img.height / img.width;
        const w = Math.min(maxW, img.width);
        const h = w * ratio;
        addAnnotation({
          id: uid('img'),
          page: currentPage,
          type: 'image',
          x: (info.width - w) / 2,
          y: (info.height - h) / 2,
          w,
          h,
          dataUrl,
          color: '#000000',
          opacity: 1,
        });
        setTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700 bg-ink-900/95 px-3 py-2 backdrop-blur">
      {/* ファイル操作 */}
      <button
        onClick={onOpenClick}
        className="flex items-center gap-1.5 rounded-lg bg-ink-700 px-3 py-2 text-sm font-medium text-ink-100 transition hover:bg-ink-600"
        title="別のPDFを開く"
      >
        <FolderOpen size={16} /> 開く
      </button>

      <Divider />

      {/* ツール */}
      <div className="flex items-center gap-1 rounded-xl bg-ink-850 p-1">
        {TOOLS.map(({ tool: t, label, Icon }) => (
          <button
            key={t}
            title={label}
            onClick={() => setTool(t)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
              tool === t
                ? 'bg-accent text-white shadow'
                : 'text-ink-100 hover:bg-ink-700'
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
        <button
          title="画像を挿入"
          onClick={() => imageInputRef.current?.click()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-100 transition hover:bg-ink-700"
        >
          <ImageIcon size={18} />
        </button>
      </div>

      <Divider />

      {/* プロパティ */}
      <label
        className="flex items-center gap-1.5 rounded-lg bg-ink-850 px-2 py-1.5 text-xs text-ink-100"
        title={usingHighlight ? 'ハイライト色' : '線・文字の色'}
      >
        <span className="text-ink-100/60">色</span>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </label>

      <label className="flex items-center gap-2 rounded-lg bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100/60">
        太さ
        <input
          type="range"
          min={1}
          max={24}
          value={settings.strokeWidth}
          onChange={(e) => onStrokeChange(Number(e.target.value))}
          className="w-20 accent-accent"
        />
        <span className="w-5 text-right tabular-nums text-ink-100">{settings.strokeWidth}</span>
      </label>

      {showFill && (
        <label
          className="flex items-center gap-1.5 rounded-lg bg-ink-850 px-2 py-1.5 text-xs text-ink-100/60"
          title="塗りつぶし"
        >
          <input
            type="checkbox"
            checked={settings.fillEnabled}
            onChange={(e) => onFillToggle(e.target.checked)}
            className="accent-accent"
          />
          塗り
          <input
            type="color"
            value={settings.fillColor}
            onChange={(e) => onFillColor(e.target.value)}
            className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
      )}

      {showFont && (
        <>
          <label
            className="flex items-center gap-1.5 rounded-lg bg-ink-850 px-2 py-1.5 text-xs text-ink-100/60"
            title="フォント"
          >
            <select
              value={settings.fontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
              className="cursor-pointer rounded bg-ink-700 px-1.5 py-1 text-ink-100 outline-none"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100/60">
            字
            <input
              type="range"
              min={8}
              max={72}
              value={settings.fontSize}
              onChange={(e) => onFontChange(Number(e.target.value))}
              className="w-20 accent-accent"
            />
            <span className="w-6 text-right tabular-nums text-ink-100">{settings.fontSize}</span>
          </label>
        </>
      )}

      <Divider />

      {/* 編集操作 */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="元に戻す (⌘Z)"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-100 transition hover:bg-ink-700 disabled:opacity-30"
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="やり直し (⌘⇧Z)"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-100 transition hover:bg-ink-700 disabled:opacity-30"
      >
        <Redo2 size={18} />
      </button>
      <button
        onClick={() => selected && deleteAnnotation(selected.id)}
        disabled={!selected}
        title="選択中の注釈を削除 (Delete)"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-300 transition hover:bg-red-500/15 disabled:opacity-30"
      >
        <Trash2 size={18} />
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* ズーム */}
        <button
          onClick={zoomOut}
          title="縮小"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-100 transition hover:bg-ink-700"
        >
          <ZoomOut size={18} />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-ink-100/70">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          title="拡大"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-100 transition hover:bg-ink-700"
        >
          <ZoomIn size={18} />
        </button>

        <Divider />

        {/* 保存 */}
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-accent-soft disabled:opacity-60"
        >
          {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          {exporting ? '書き出し中…' : 'PDFを保存'}
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
