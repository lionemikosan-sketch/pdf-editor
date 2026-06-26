import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Toolbar } from '@/components/Toolbar';
import { Workspace } from '@/components/Workspace';
import { exportAnnotatedPdf, downloadPdf } from '@/lib/export';

export default function App() {
  const doc = useStore((s) => s.doc);
  const fileName = useStore((s) => s.fileName);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const openPdf = useStore((s) => s.openPdf);
  const setExporting = useStore((s) => s.setExporting);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const openFileDialog = useCallback(() => fileInputRef.current?.click(), []);

  const pickFile = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && file.type === 'application/pdf') openPdf(file);
    },
    [openPdf],
  );

  const openSample = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample.pdf`);
      const blob = await res.blob();
      openPdf(new File([blob], 'sample.pdf', { type: 'application/pdf' }));
    } catch (e) {
      console.error(e);
    }
  }, [openPdf]);

  const handleExport = useCallback(async () => {
    const { originalBytes, annotations, pages, fileName: fn } = useStore.getState();
    if (!originalBytes) return;
    setExporting(true);
    setExportError(null);
    try {
      const out = await exportAnnotatedPdf(originalBytes, annotations, pages);
      const base = (fn ?? 'document.pdf').replace(/\.pdf$/i, '');
      downloadPdf(out, `${base}_注釈.pdf`);
    } catch (e) {
      console.error(e);
      setExportError('PDFの書き出しに失敗しました。');
    } finally {
      setExporting(false);
    }
  }, [setExporting]);

  // キーボードショートカット
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const editing =
        !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;
      const { setTool, undo, redo, selectedId, deleteAnnotation } = useStore.getState();

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (editing) return;

      const map: Record<string, Parameters<typeof setTool>[0]> = {
        v: 'select',
        t: 'text',
        p: 'pen',
        h: 'highlight',
        l: 'line',
        a: 'arrow',
        r: 'rect',
        o: 'ellipse',
      };
      const key = e.key.toLowerCase();
      if (map[key]) {
        setTool(map[key]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteAnnotation(selectedId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {doc ? (
        <>
          <Toolbar onExport={handleExport} onOpenClick={openFileDialog} />
          <Workspace />
        </>
      ) : (
        <EmptyState
          dragging={dragging}
          loading={loading}
          onOpenClick={openFileDialog}
          onOpenSample={openSample}
          onDragState={setDragging}
          onDropFiles={pickFile}
        />
      )}

      {/* エラー表示 */}
      {(error || exportError) && (
        <div className="fixed bottom-5 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-panel">
          <span>{error || exportError}</span>
          <button
            onClick={() => {
              useStore.setState({ error: null });
              setExportError(null);
            }}
            className="text-red-200/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files);
          e.target.value = '';
        }}
      />

      {fileName && (
        <div className="pointer-events-none fixed left-3 top-2 z-40 max-w-[40vw] truncate text-[11px] text-ink-100/30">
          {fileName}
        </div>
      )}
    </div>
  );
}

interface EmptyProps {
  dragging: boolean;
  loading: boolean;
  onOpenClick: () => void;
  onOpenSample: () => void;
  onDragState: (v: boolean) => void;
  onDropFiles: (files: FileList | null) => void;
}

function EmptyState({
  dragging,
  loading,
  onOpenClick,
  onOpenSample,
  onDragState,
  onDropFiles,
}: EmptyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink-100">PDF注釈エディタ</h1>
        <p className="mt-2 text-sm text-ink-100/50">
          テキスト・ペン・ハイライト・図形・画像を重ねて書き込み、PDFとして保存。
          <br />
          ファイルは端末内だけで処理され、どこにもアップロードされません。
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenClick}
        onDragOver={(e) => {
          e.preventDefault();
          onDragState(true);
        }}
        onDragLeave={() => onDragState(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragState(false);
          onDropFiles(e.dataTransfer.files);
        }}
        className={`flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 transition ${
          dragging
            ? 'border-accent bg-accent/10'
            : 'border-ink-600 bg-ink-900/60 hover:border-accent/60 hover:bg-ink-850'
        }`}
      >
        {loading ? (
          <Loader2 size={40} className="spin text-accent" />
        ) : (
          <FileUp size={40} className="text-accent" />
        )}
        <div className="text-center">
          <div className="text-base font-semibold text-ink-100">
            {loading ? '読み込み中…' : 'PDFをドロップ、またはクリックして選択'}
          </div>
          <div className="mt-1 text-xs text-ink-100/40">対応形式: PDF</div>
        </div>
      </button>

      <button
        onClick={onOpenSample}
        className="mt-5 text-xs text-accent-soft underline-offset-4 transition hover:underline"
      >
        またはサンプルPDFで試す
      </button>

      <p className="mt-6 text-xs text-ink-100/30">完全オフライン / クライアントサイド処理</p>
    </div>
  );
}
