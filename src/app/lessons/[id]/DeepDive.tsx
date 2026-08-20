"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function MarkdownMath({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

// Splits a dive's markdown into displayable text and the optional ```viz block.
// While streaming, an unterminated viz block is hidden behind a placeholder.
function splitViz(md: string): { display: string; viz: string | null; vizPending: boolean } {
  const start = md.indexOf("```viz");
  if (start === -1) return { display: md, viz: null, vizPending: false };
  const afterFence = start + "```viz".length;
  const end = md.indexOf("```", afterFence);
  const display = md.slice(0, start) + (end === -1 ? "" : md.slice(end + 3));
  if (end === -1) return { display, viz: null, vizPending: true };
  return { display, viz: md.slice(afterFence, end).trim(), vizPending: false };
}

type ChipState = { x: number; y: number; text: string; context: string };
type DiveFrame = { selection: string; md: string };

// Wraps lesson content: highlight any text -> "Go deeper" chip -> streaming
// dive popover. Selections inside the popover dive further (with a back stack).
export default function DiveableArticle({
  lessonId,
  content,
}: {
  lessonId: string;
  content: string;
}) {
  const articleRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [chip, setChip] = useState<ChipState | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [stack, setStack] = useState<DiveFrame[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const readSelection = useCallback((container: HTMLElement): ChipState | null => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0) return null;
    if (!container.contains(s.anchorNode)) return null;
    const text = s.toString().trim();
    if (text.length < 2 || text.length > 300) return null;
    const rect = s.getRangeAt(0).getBoundingClientRect();
    const all = container.textContent ?? "";
    const idx = all.indexOf(text);
    const context =
      idx === -1 ? "" : all.slice(Math.max(0, idx - 300), idx + text.length + 300);
    return { x: rect.left + rect.width / 2, y: rect.top, text, context };
  }, []);

  // Dismiss the chip when clicking anywhere that isn't the chip or popover.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[data-dive-chip]") || popoverRef.current?.contains(t)) return;
      setChip(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        setStack([]);
        setChip(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function startDive(sel: ChipState, nested: boolean) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChip(null);
    setError(null);
    setStreaming(true);
    if (!nested) {
      const x = Math.min(Math.max(sel.x - 230, 16), window.innerWidth - 476);
      const y = Math.min(sel.y + 28, window.innerHeight - 200);
      setPos({ x, y });
    }
    setStack((prev) => (nested ? [...prev, { selection: sel.text, md: "" }] : [{ selection: sel.text, md: "" }]));

    try {
      const res = await fetch("/api/dives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, selection: sel.text, context: sel.context }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Deep dive failed.");
      }
      if (!res.body) throw new Error("Deep dive failed.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "text") {
            setStack((prev) => {
              const next = [...prev];
              const top = next[next.length - 1];
              if (top) next[next.length - 1] = { ...top, md: top.md + event.text };
              return next;
            });
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Deep dive failed.");
      }
    } finally {
      setStreaming(false);
    }
  }

  const top = stack[stack.length - 1];
  const parsed = top ? splitViz(top.md) : null;

  return (
    <>
      <div
        ref={articleRef}
        onMouseUp={() => {
          if (!articleRef.current) return;
          const sel = readSelection(articleRef.current);
          if (sel) setChip(sel);
        }}
      >
        <article className="prose prose-neutral max-w-none dark:prose-invert">
          <MarkdownMath>{content}</MarkdownMath>
        </article>
        {content && (
          <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-600">
            Confused by anything? Highlight it and hit “Go deeper”.
          </p>
        )}
      </div>

      {chip && (
        <button
          data-dive-chip
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => startDive(chip, stack.length > 0)}
          className="fixed z-40 -translate-x-1/2 -translate-y-full rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-85 dark:bg-white dark:text-neutral-900"
          style={{ left: chip.x, top: chip.y - 6 }}
        >
          ⤵ Go deeper
        </button>
      )}

      {top && pos && (
        <div
          ref={popoverRef}
          className="fixed z-30 flex w-[460px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-950"
          style={{ left: pos.x, top: pos.y, maxHeight: `min(65vh, calc(100vh - ${pos.y + 16}px))` }}
        >
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            {stack.length > 1 && (
              <button
                onClick={() => setStack((prev) => prev.slice(0, -1))}
                className="rounded px-1.5 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                title="Back"
              >
                ←
              </button>
            )}
            <div className="min-w-0 flex-1 truncate text-sm font-medium">
              {top.selection}
            </div>
            <button
              onClick={() => {
                abortRef.current?.abort();
                setStack([]);
              }}
              className="rounded px-1.5 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            onMouseUp={(e) => {
              const sel = readSelection(e.currentTarget as HTMLElement);
              if (sel) setChip(sel);
            }}
          >
            {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!top.md && streaming && (
              <p className="animate-pulse text-sm text-neutral-500">Diving in…</p>
            )}
            <article className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
              <MarkdownMath>{parsed?.display ?? ""}</MarkdownMath>
            </article>
            {parsed?.vizPending && (
              <p className="mt-2 animate-pulse text-xs text-neutral-500">
                Building an interactive demo…
              </p>
            )}
            {parsed?.viz && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={parsed.viz}
                title={`Interactive demo: ${top.selection}`}
                loading="lazy"
                className="mt-3 h-[360px] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-700"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
