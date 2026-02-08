"use client";

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

interface LatexSourcePaneProps {
  latex: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onScroll?: () => void;
}

export interface LatexSourcePaneRef {
  textarea: HTMLTextAreaElement | null;
}

export const LatexSourcePane = forwardRef<LatexSourcePaneRef, LatexSourcePaneProps>(
  function LatexSourcePane({ latex, onChange, readOnly, onScroll }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const underlayRef = useRef<HTMLDivElement>(null);
  const lines = latex.split("\n");

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
              {highlightLine(line)}
            </div>
          ))}
        </div>
      </div>

      {/* Editable textarea (transparent text over highlighted underlay) */}
      <textarea
        ref={textareaRef}
        value={latex}
        onChange={(e) => onChange(e.target.value)}
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

function highlightLine(line: string): React.ReactNode {
  if (!line) return " ";

  // Comments
  if (line.trimStart().startsWith("%")) {
    return <span className="text-[var(--muted-soft)] italic">{line}</span>;
  }

  // Section commands
  if (/^\\(section|subsection|subsubsection|title)\b/.test(line)) {
    return <span className="text-[var(--accent)] font-medium">{line}</span>;
  }

  // Environment begin/end
  if (/^\\(begin|end)\{/.test(line)) {
    return <span className="text-[#7a5a8c]">{line}</span>;
  }

  // Items and text formatting
  if (/^\\(item|textbf|textit)\b/.test(line)) {
    return <span className="text-[var(--success)]">{line}</span>;
  }

  // Other commands
  if (line.trimStart().startsWith("\\")) {
    return <span className="text-[var(--info)]">{line}</span>;
  }

  return <span className="text-[var(--foreground)]">{line}</span>;
}
