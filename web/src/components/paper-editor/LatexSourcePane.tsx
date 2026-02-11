"use client";

import { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";

export interface SourceHighlightRange {
  start: number;
  end: number;
}

interface LatexSourcePaneProps {
  latex: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onScroll?: () => void;
  highlightRange?: SourceHighlightRange | null;
  onSelectionChange?: (range: SourceHighlightRange | null) => void;
}

export interface LatexSourcePaneRef {
  textarea: HTMLTextAreaElement | null;
}

export const LatexSourcePane = forwardRef<LatexSourcePaneRef, LatexSourcePaneProps>(
  function LatexSourcePane(
    { latex, onChange, readOnly, onScroll, highlightRange, onSelectionChange },
    ref
  ) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const underlayRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => latex.split("\n"), [latex]);
  const lineStarts = useMemo(() => {
    const starts: number[] = [];
    let current = 0;
    for (const line of lines) {
      starts.push(current);
      current += line.length + 1;
    }
    return starts;
  }, [lines]);

  // Expose textarea ref to parent
  useImperativeHandle(ref, () => ({
    textarea: textareaRef.current,
  }), []);

  // Sync gutter and underlay scroll with textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
      if (underlayRef.current) {
        underlayRef.current.scrollTop = scrollTop;
      }
    }
    // Call external scroll handler
    onScroll?.();
  }, [onScroll]);

  const handleSelection = useCallback(() => {
    if (!onSelectionChange || !textareaRef.current) return;
    const ta = textareaRef.current;
    const start = Math.min(ta.selectionStart, ta.selectionEnd);
    const end = Math.max(ta.selectionStart, ta.selectionEnd);
    onSelectionChange(start === end ? null : { start, end });
  }, [onSelectionChange]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.addEventListener("scroll", handleScroll);
      return () => ta.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  return (
    <div className="flex h-full bg-[var(--background-warm)] relative">
      {/* Line numbers gutter */}
      <div
        ref={gutterRef}
        className="flex-none w-12 overflow-y-auto select-none pt-4 pb-4 text-right pr-3 border-r border-[var(--border)]/50 scrollbar-hidden"
        style={{ fontFamily: "var(--font-mono), monospace", fontSize: "13px", lineHeight: "1.6" }}
      >
        {lines.map((_, i) => (
          <div key={i} className="text-[var(--muted-soft)] text-[11px]">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Syntax-highlighted underlay */}
      <div
        ref={underlayRef}
        className="absolute left-12 top-0 right-0 bottom-0 pointer-events-none overflow-y-auto pt-4 pb-4 pl-3 pr-4 scrollbar-hidden"
        aria-hidden="true"
      >
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "13px", lineHeight: "1.6" }}>
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {highlightLine(line, lineStarts[i] ?? 0, highlightRange ?? null)}
            </div>
          ))}
        </div>
      </div>

      {/* Editable textarea (transparent text over highlighted underlay) */}
      <textarea
        ref={textareaRef}
        value={latex}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleSelection}
        onKeyUp={handleSelection}
        onMouseUp={handleSelection}
        readOnly={readOnly}
        className="flex-1 bg-transparent text-transparent caret-[var(--foreground)] resize-none outline-none pt-4 pb-4 pl-3 pr-4 relative z-10 overflow-y-auto"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
});

function lineClass(line: string): string {
  if (!line) return "text-[var(--foreground)]";

  if (line.trimStart().startsWith("%")) {
    return "text-[var(--muted-soft)] italic";
  }

  if (/^\\(section|subsection|subsubsection|title)\b/.test(line)) {
    return "text-[var(--accent)] font-medium";
  }

  if (/^\\(begin|end)\{/.test(line)) {
    return "text-[#7a5a8c]";
  }

  if (/^\\(item|textbf|textit)\b/.test(line)) {
    return "text-[var(--success)]";
  }

  if (line.trimStart().startsWith("\\")) {
    return "text-[var(--info)]";
  }

  return "text-[var(--foreground)]";
}

function highlightLine(
  line: string,
  lineStart: number,
  highlightRange: SourceHighlightRange | null
): React.ReactNode {
  if (!line) return " ";
  const cls = lineClass(line);

  if (!highlightRange || highlightRange.end <= lineStart || highlightRange.start >= lineStart + line.length) {
    return <span className={cls}>{line}</span>;
  }

  const overlapStart = Math.max(0, highlightRange.start - lineStart);
  const overlapEnd = Math.min(line.length, highlightRange.end - lineStart);

  if (overlapStart >= overlapEnd) {
    return <span className={cls}>{line}</span>;
  }

  const before = line.slice(0, overlapStart);
  const selected = line.slice(overlapStart, overlapEnd);
  const after = line.slice(overlapEnd);

  return (
    <>
      {before && <span className={cls}>{before}</span>}
      {selected && (
        <span className={`${cls} bg-[var(--accent-light)] ring-1 ring-[var(--accent-muted)]/40 rounded-[2px]`}>
          {selected}
        </span>
      )}
      {after && <span className={cls}>{after}</span>}
    </>
  );
}
