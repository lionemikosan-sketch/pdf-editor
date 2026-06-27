import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { PageView } from './PageView';

const TOOL_HINTS: Record<string, string> = {
  text: 'ドラッグでテキストボックスの範囲を作成 → 中に入力（クリックだけでもOK）',
  pen: 'ドラッグして手書きで描けます',
  highlight: 'ドラッグした部分を蛍光ペンでマークします',
  line: 'ドラッグして直線を引きます',
  arrow: 'ドラッグして矢印を引きます',
  rect: 'ドラッグして四角形を描きます',
  ellipse: 'ドラッグして楕円を描きます',
};

export function Workspace() {
  const pages = useStore((s) => s.pages);
  const fileName = useStore((s) => s.fileName);
  const tool = useStore((s) => s.tool);
  const setScale = useStore((s) => s.setScale);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const currentPage = useStore((s) => s.currentPage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ratios = useRef<number[]>([]);

  // 新しいPDFを開いたら横幅にフィットさせる
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || pages.length === 0) return;
    const avail = el.clientWidth - 48; // 左右パディング相当
    const fit = avail / pages[0].width;
    setScale(Math.max(0.25, Math.min(2, fit)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  // 表示中ページの追跡
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;
    ratios.current = new Array(pages.length).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (!Number.isNaN(idx)) ratios.current[idx] = entry.intersectionRatio;
        }
        let best = 0;
        let bestRatio = -1;
        ratios.current.forEach((r, i) => {
          if (r > bestRatio) {
            bestRatio = r;
            best = i;
          }
        });
        setCurrentPage(best);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [pages, setCurrentPage]);

  const hint = TOOL_HINTS[tool];

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* ツール操作のヒント */}
      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-accent/40 bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent-soft shadow-panel backdrop-blur">
          {hint}
        </div>
      )}
      <div
        ref={scrollRef}
        className="scroll-area h-full overflow-auto bg-ink-950 px-6 py-6"
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-6">
          {pages.map((info, i) => (
            <div
              key={info.index}
              data-page-index={i}
              ref={(el) => (pageRefs.current[i] = el)}
              className="relative"
            >
              <div className="pointer-events-none absolute -left-12 top-0 select-none text-xs font-medium text-ink-100/40">
                {i + 1}
              </div>
              <PageView info={info} />
            </div>
          ))}
        </div>
      </div>

      {/* ページインジケータ */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-800/90 px-3 py-1 text-xs font-medium text-ink-100/80 shadow-panel backdrop-blur">
        ページ {currentPage + 1} / {pages.length}
      </div>
    </div>
  );
}
