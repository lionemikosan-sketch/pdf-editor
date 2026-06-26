import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Annotation, PageInfo, Tool, ToolSettings } from '@/types';
import { loadPdf } from '@/lib/pdf';

const MAX_HISTORY = 80;

interface State {
  fileName: string | null;
  originalBytes: Uint8Array | null; // 書き出し用に保持する元PDF
  doc: PDFDocumentProxy | null;
  pages: PageInfo[];

  annotations: Annotation[];
  past: Annotation[][];
  future: Annotation[][];

  tool: Tool;
  settings: ToolSettings;
  selectedId: string | null;
  editingTextId: string | null;

  displayScale: number;
  currentPage: number; // 表示中（最前面）のページ index
  loading: boolean;
  error: string | null;
  exporting: boolean;
}

interface Actions {
  openPdf: (file: File) => Promise<void>;
  closePdf: () => void;

  setTool: (tool: Tool) => void;
  setSettings: (patch: Partial<ToolSettings>) => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setCurrentPage: (page: number) => void;

  select: (id: string | null) => void;
  setEditingText: (id: string | null) => void;

  addAnnotation: (a: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearPage: (page: number) => void;

  undo: () => void;
  redo: () => void;

  setExporting: (v: boolean) => void;
}

const defaultSettings: ToolSettings = {
  color: '#e23b3b',
  fillEnabled: false,
  fillColor: '#ffd54a',
  strokeWidth: 3,
  fontSize: 16,
  highlightColor: '#ffe14d',
};

function clone(a: Annotation[]): Annotation[] {
  return a.map((x) => ({ ...x }));
}

export const useStore = create<State & Actions>((set, get) => ({
  fileName: null,
  originalBytes: null,
  doc: null,
  pages: [],

  annotations: [],
  past: [],
  future: [],

  tool: 'select',
  settings: defaultSettings,
  selectedId: null,
  editingTextId: null,

  displayScale: 1,
  currentPage: 0,
  loading: false,
  error: null,
  exporting: false,

  openPdf: async (file) => {
    set({ loading: true, error: null });
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      // pdf.js は渡したバッファを detach しうるのでコピーを渡す
      const { doc, pages } = await loadPdf(buf.slice());
      get().doc?.destroy();
      set({
        fileName: file.name,
        originalBytes: buf,
        doc,
        pages,
        annotations: [],
        past: [],
        future: [],
        selectedId: null,
        editingTextId: null,
        tool: 'select',
        currentPage: 0,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      set({
        loading: false,
        error: 'PDFを読み込めませんでした。ファイルが破損しているか、対応していない形式の可能性があります。',
      });
    }
  },

  closePdf: () => {
    get().doc?.destroy();
    set({
      fileName: null,
      originalBytes: null,
      doc: null,
      pages: [],
      annotations: [],
      past: [],
      future: [],
      selectedId: null,
      editingTextId: null,
      error: null,
    });
  },

  setTool: (tool) =>
    set((s) => ({
      tool,
      selectedId: tool === 'select' ? s.selectedId : null,
      editingTextId: null,
    })),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setScale: (scale) => set({ displayScale: Math.max(0.25, Math.min(4, scale)) }),
  zoomIn: () => get().setScale(get().displayScale * 1.2),
  zoomOut: () => get().setScale(get().displayScale / 1.2),
  setCurrentPage: (page) => set({ currentPage: page }),

  select: (id) => set({ selectedId: id }),
  setEditingText: (id) => set({ editingTextId: id }),

  addAnnotation: (a) =>
    set((s) => ({
      past: [...s.past, clone(s.annotations)].slice(-MAX_HISTORY),
      future: [],
      annotations: [...s.annotations, a],
      selectedId: a.id,
    })),

  updateAnnotation: (id, patch) =>
    set((s) => ({
      past: [...s.past, clone(s.annotations)].slice(-MAX_HISTORY),
      future: [],
      annotations: s.annotations.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Annotation) : a,
      ),
    })),

  deleteAnnotation: (id) =>
    set((s) => ({
      past: [...s.past, clone(s.annotations)].slice(-MAX_HISTORY),
      future: [],
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingTextId: s.editingTextId === id ? null : s.editingTextId,
    })),

  clearPage: (page) =>
    set((s) => ({
      past: [...s.past, clone(s.annotations)].slice(-MAX_HISTORY),
      future: [],
      annotations: s.annotations.filter((a) => a.page !== page),
      selectedId: null,
      editingTextId: null,
    })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        future: [clone(s.annotations), ...s.future].slice(0, MAX_HISTORY),
        annotations: previous,
        selectedId: null,
        editingTextId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, clone(s.annotations)].slice(-MAX_HISTORY),
        future: s.future.slice(1),
        annotations: next,
        selectedId: null,
        editingTextId: null,
      };
    }),

  setExporting: (v) => set({ exporting: v }),
}));
