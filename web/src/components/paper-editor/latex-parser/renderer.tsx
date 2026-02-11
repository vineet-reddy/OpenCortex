"use client";

import { useRef, useCallback } from "react";
import { LatexNode, ParseResult } from "./types";

// Dynamically import KaTeX CSS and render math
let katexLoaded = false;
function renderMath(tex: string, displayMode: boolean): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const katex = require("katex");
    if (!katexLoaded) {
      katexLoaded = true;
    }
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return displayMode ? `$$${tex}$$` : `$${tex}$`;
  }
}

function overlapsRange(
  start: number,
  end: number,
  range: { start: number; end: number } | null
): boolean {
  if (!range) return false;
  return Math.max(start, range.start) < Math.min(end, range.end);
}

function blockHighlightClass(isHighlighted: boolean): string {
  return isHighlighted
    ? "bg-[var(--accent-light)]/70 ring-1 ring-[var(--accent-muted)]/45 rounded-md"
    : "";
}

interface RenderedLatexProps {
  parseResult: ParseResult;
  editable?: boolean;
  onParagraphEdit?: (paragraphId: string, newText: string) => void;
  onParagraphClick?: (paragraphId: string, element: HTMLElement) => void;
  commentCounts?: Record<string, number>;
  onAddComment?: (paragraphId: string) => void;
  highlightRange?: { start: number; end: number } | null;
}

export function RenderedLatex({
  parseResult,
  editable = false,
  onParagraphEdit,
  onParagraphClick,
  commentCounts = {},
  onAddComment,
  highlightRange = null,
}: RenderedLatexProps) {
  const { nodes, metadata } = parseResult;

  return (
    <div className="rendered-paper" style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}>
      {/* Title block */}
      {metadata.title && (
        <div className="mb-6 pb-4 border-b border-[var(--border)]">
          <h1
            className="text-[24px] leading-snug mb-2"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 600 }}
          >
            {renderInlineText(metadata.title)}
          </h1>
          {metadata.authors && (
            <p className="text-[14px] text-[var(--muted)] italic">{renderInlineText(metadata.authors)}</p>
          )}
          {metadata.date && (
            <p className="text-[13px] text-[var(--muted-soft)] mt-1">{metadata.date}</p>
          )}
        </div>
      )}

      {/* Body nodes */}
      {nodes.map((n) => (
        <BlockNode
          key={n.paragraphId}
          node={n}
          editable={editable}
          onParagraphEdit={onParagraphEdit}
          onParagraphClick={onParagraphClick}
          commentCount={commentCounts[n.paragraphId] || 0}
          onAddComment={onAddComment}
          highlightRange={highlightRange}
        />
      ))}
    </div>
  );
}

interface BlockNodeProps {
  node: LatexNode;
  editable?: boolean;
  onParagraphEdit?: (paragraphId: string, newText: string) => void;
  onParagraphClick?: (paragraphId: string, element: HTMLElement) => void;
  commentCount?: number;
  onAddComment?: (paragraphId: string) => void;
  highlightRange?: { start: number; end: number } | null;
}

function BlockNode({
  node: n,
  editable,
  onParagraphEdit,
  onParagraphClick,
  commentCount = 0,
  onAddComment,
  highlightRange = null,
}: BlockNodeProps) {
  const ref = useRef<HTMLElement | null>(null);
  const isHighlighted = overlapsRange(n.sourceRange.start, n.sourceRange.end, highlightRange);

  const handleBlur = useCallback(() => {
    if (!editable || !onParagraphEdit || !ref.current) return;
    const newText = ref.current.innerText;
    onParagraphEdit(n.paragraphId, newText);
  }, [editable, onParagraphEdit, n.paragraphId]);

  const handleClick = useCallback(() => {
    if (onParagraphClick && ref.current) {
      onParagraphClick(n.paragraphId, ref.current);
    }
  }, [onParagraphClick, n.paragraphId]);

  // Callback ref to handle different element types
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  const commentButton = onAddComment && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAddComment(n.paragraphId);
      }}
      className="absolute -right-8 top-0 opacity-0 group-hover/block:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[12px] hover:scale-110"
      title="Add comment"
    >
      +
    </button>
  );

  const commentBadge = commentCount > 0 && (
    <span className="absolute -right-8 top-0 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--warning-light)] text-amber-800 text-[11px] font-medium">
      {commentCount}
    </span>
  );

  switch (n.type) {
    case "comment":
      return null;

    case "abstract":
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`relative group/block border-l-3 border-[var(--accent-muted)] pl-4 my-5 py-1 italic text-[15px] leading-[1.7] text-[var(--foreground-soft)] ${blockHighlightClass(isHighlighted)}`}
        >
          <span className="text-[12px] uppercase tracking-wider text-[var(--muted)] not-italic block mb-2" style={{ fontFamily: "var(--font-mono), monospace" }}>
            Abstract
          </span>
          <div
            ref={setRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onClick={handleClick}
            className={editable ? "outline-none focus:ring-2 focus:ring-[var(--accent-muted)] focus:ring-offset-2 rounded px-1 -mx-1" : ""}
          >
            <InlineContent
              nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
              highlightRange={highlightRange}
            />
          </div>
          {commentBadge || commentButton}
        </div>
      );

    case "section":
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`relative group/block ${blockHighlightClass(isHighlighted)}`}
        >
          <h2
            ref={setRef}
            className="text-[19px] mt-7 mb-3 pb-1 border-b border-[var(--border)]/50"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 600 }}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onClick={handleClick}
          >
            <InlineContent
              nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
              highlightRange={highlightRange}
            />
          </h2>
          {commentBadge || commentButton}
        </div>
      );

    case "subsection":
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`relative group/block ${blockHighlightClass(isHighlighted)}`}
        >
          <h3
            ref={setRef}
            className="text-[17px] mt-5 mb-2"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 600 }}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onClick={handleClick}
          >
            <InlineContent
              nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
              highlightRange={highlightRange}
            />
          </h3>
          {commentBadge || commentButton}
        </div>
      );

    case "subsubsection":
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`relative group/block ${blockHighlightClass(isHighlighted)}`}
        >
          <h4
            ref={setRef}
            className="text-[15px] font-semibold mt-4 mb-2"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif" }}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onClick={handleClick}
          >
            <InlineContent
              nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
              highlightRange={highlightRange}
            />
          </h4>
          {commentBadge || commentButton}
        </div>
      );

    case "enumerate":
      return (
        <ol
          className={`list-decimal pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] ${blockHighlightClass(isHighlighted)}`}
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
        >
          {n.children.map((item) => (
            <BlockNode
              key={item.paragraphId}
              node={item}
              editable={editable}
              onParagraphEdit={onParagraphEdit}
              onParagraphClick={onParagraphClick}
              highlightRange={highlightRange}
            />
          ))}
        </ol>
      );

    case "itemize":
      return (
        <ul
          className={`list-disc pl-6 my-3 space-y-1.5 text-[15px] leading-[1.7] ${blockHighlightClass(isHighlighted)}`}
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
        >
          {n.children.map((item) => (
            <BlockNode
              key={item.paragraphId}
              node={item}
              editable={editable}
              onParagraphEdit={onParagraphEdit}
              onParagraphClick={onParagraphClick}
              highlightRange={highlightRange}
            />
          ))}
        </ul>
      );

    case "item":
      return (
        <li
          ref={setRef}
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          contentEditable={editable}
          suppressContentEditableWarning
          onBlur={handleBlur}
          className={`${editable ? "outline-none focus:ring-2 focus:ring-[var(--accent-muted)] focus:ring-offset-2 rounded" : ""} ${blockHighlightClass(isHighlighted)}`}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </li>
      );

    case "math-display":
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`my-4 px-4 py-3 text-center overflow-x-auto ${blockHighlightClass(isHighlighted)}`}
          dangerouslySetInnerHTML={{ __html: renderMath(n.content, true) }}
        />
      );

    case "paragraph":
    default:
      return (
        <div
          data-paragraph-id={n.paragraphId}
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`relative group/block ${blockHighlightClass(isHighlighted)}`}
        >
          <p
            ref={setRef}
            className={`text-[15px] leading-[1.75] mb-3 text-[var(--foreground-soft)] ${
              editable ? "outline-none focus:ring-2 focus:ring-[var(--accent-muted)] focus:ring-offset-2 rounded px-1 -mx-1" : ""
            }`}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={handleBlur}
            onClick={handleClick}
          >
            <InlineContent
              nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
              highlightRange={highlightRange}
            />
          </p>
          {commentBadge || commentButton}
        </div>
      );
  }
}

function InlineContent({
  nodes,
  highlightRange,
}: {
  nodes: LatexNode[];
  highlightRange: { start: number; end: number } | null;
}) {
  return (
    <>
      {nodes.map((n, i) => (
        <InlineNode key={i} node={n} highlightRange={highlightRange} />
      ))}
    </>
  );
}

function InlineNode({
  node: n,
  highlightRange,
}: {
  node: LatexNode;
  highlightRange: { start: number; end: number } | null;
}) {
  const isHighlighted = overlapsRange(n.sourceRange.start, n.sourceRange.end, highlightRange);

  if (n.type === "text") {
    return renderTextWithHighlight(n, highlightRange);
  }

  switch (n.type) {
    case "textbf":
      return (
        <strong
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </strong>
      );

    case "textit":
    case "emph":
      return (
        <em
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </em>
      );

    case "textsuperscript":
      return (
        <sup
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </sup>
      );

    case "textsubscript":
      return (
        <sub
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </sub>
      );

    case "underline":
      return (
        <u
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}
        >
          <InlineContent
            nodes={n.children.length > 0 ? n.children : [{ type: "text", content: n.content, children: [], sourceRange: n.sourceRange, paragraphId: n.paragraphId }]}
            highlightRange={highlightRange}
          />
        </u>
      );

    case "math-inline":
      return (
        <span
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`inline-block align-middle ${isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMath(n.content, false) }}
        />
      );

    case "math-display":
      return (
        <div
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`my-2 text-center ${isHighlighted ? "bg-[var(--accent-light)]/70 rounded-sm" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMath(n.content, true) }}
        />
      );

    case "comment":
      return null;

    case "unknown-command":
      return (
        <span
          data-source-start={n.sourceRange.start}
          data-source-end={n.sourceRange.end}
          className={`text-[var(--muted)] text-[13px] px-0.5 rounded bg-[var(--surface-warm)] ${isHighlighted ? "ring-1 ring-[var(--accent-muted)]/40" : ""}`}
          style={{ fontFamily: "var(--font-mono), monospace" }}
          title={n.content}
        >
          {n.content}
        </span>
      );

    default:
      return <>{n.content}</>;
  }
}

function renderTextWithHighlight(
  node: LatexNode,
  highlightRange: { start: number; end: number } | null
) {
  const text = node.content;
  const sourceStart = node.sourceRange.start;
  const sourceEnd = node.sourceRange.end;

  if (!highlightRange || !overlapsRange(sourceStart, sourceEnd, highlightRange)) {
    return (
      <span data-source-start={sourceStart} data-source-end={sourceEnd}>
        {text}
      </span>
    );
  }

  const sourceLen = Math.max(1, sourceEnd - sourceStart);
  const textLen = text.length;
  const overlapStart = Math.max(sourceStart, highlightRange.start);
  const overlapEnd = Math.min(sourceEnd, highlightRange.end);

  const startRatio = (overlapStart - sourceStart) / sourceLen;
  const endRatio = (overlapEnd - sourceStart) / sourceLen;
  const textStart = Math.max(0, Math.min(textLen, Math.floor(startRatio * textLen)));
  const textEnd = Math.max(textStart, Math.min(textLen, Math.ceil(endRatio * textLen)));

  const before = text.slice(0, textStart);
  const selected = text.slice(textStart, textEnd);
  const after = text.slice(textEnd);

  return (
    <span data-source-start={sourceStart} data-source-end={sourceEnd}>
      {before}
      {selected && (
        <span className="bg-[var(--accent-light)] ring-1 ring-[var(--accent-muted)]/45 rounded-[2px]">
          {selected}
        </span>
      )}
      {after}
    </span>
  );
}

/** Render inline LaTeX formatting within a single text string (for metadata) */
function renderInlineText(text: string): React.ReactNode {
  // Simple handling: render \textsuperscript as <sup>, rest as text
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const cmdIdx = remaining.indexOf("\\");
    if (cmdIdx < 0) {
      parts.push(remaining);
      break;
    }

    if (cmdIdx > 0) {
      parts.push(remaining.slice(0, cmdIdx));
    }

    const afterCmd = remaining.slice(cmdIdx);
    const match = afterCmd.match(/^\\(textsuperscript|textsubscript|textbf|textit|emph)\{([^}]*)\}/);
    if (match) {
      const [full, cmd, content] = match;
      if (cmd === "textsuperscript") parts.push(<sup key={key++}>{content}</sup>);
      else if (cmd === "textsubscript") parts.push(<sub key={key++}>{content}</sub>);
      else if (cmd === "textbf") parts.push(<strong key={key++}>{content}</strong>);
      else parts.push(<em key={key++}>{content}</em>);
      remaining = remaining.slice(cmdIdx + full.length);
    } else {
      // Unknown command, output as-is
      const spaceIdx = afterCmd.indexOf(" ", 1);
      const end = spaceIdx > 0 ? spaceIdx : afterCmd.length;
      parts.push(afterCmd.slice(0, end));
      remaining = remaining.slice(cmdIdx + end);
    }
  }

  return <>{parts}</>;
}
