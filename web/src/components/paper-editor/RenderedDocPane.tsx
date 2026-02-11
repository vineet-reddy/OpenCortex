"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  forwardRef,
} from "react";
import { ParseResult, LatexNode } from "./latex-parser/types";
import { RenderedLatex } from "./latex-parser/renderer";
import { PaperComment } from "./hooks/usePaperData";
import { getPlainText } from "./latex-parser/parser";
import {
  findNodeByAnchorText,
  findNodeById,
  findNodeBySourceOffset,
  findPlainTextRangeInNode,
  mapPlainRangeToSource,
} from "./latex-parser/source-map";
import { CommentThread } from "./CommentThread";
import { SourceHighlightRange } from "./LatexSourcePane";

export interface CommentAnchorPayload {
  paragraphId: string | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  lineNumber: number | null;
  anchorText: string | null;
}

interface RenderedDocPaneProps {
  parseResult: ParseResult;
  latexSource: string;
  editable: boolean;
  onParagraphEdit: (paragraphId: string, newText: string) => void;
  comments: PaperComment[];
  onAddComment: (content: string, anchor: CommentAnchorPayload) => void;
  onScroll?: () => void;
  highlightRange?: SourceHighlightRange | null;
  onSelectionChange?: (range: SourceHighlightRange | null) => void;
}

export const RenderedDocPane = forwardRef<HTMLDivElement, RenderedDocPaneProps>(
  function RenderedDocPane(
    {
      parseResult,
      latexSource,
      editable,
      onParagraphEdit,
      comments,
      onAddComment,
      onScroll,
      highlightRange = null,
      onSelectionChange,
    },
    ref
  ) {
    const [activeCommentParagraph, setActiveCommentParagraph] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [pendingAnchor, setPendingAnchor] = useState<CommentAnchorPayload | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const setContainerRef = useCallback(
      (el: HTMLDivElement | null) => {
        containerRef.current = el;
        if (typeof ref === "function") {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
      },
      [ref]
    );

    const commentsByParagraph = useMemo(() => {
      const map: Record<string, PaperComment[]> = {};

      for (const comment of comments) {
        let paragraphId: string | null = null;

        if (comment.paragraphId && findNodeById(parseResult.nodes, comment.paragraphId)) {
          paragraphId = comment.paragraphId;
        }

        if (!paragraphId && comment.sourceStart != null) {
          const node = findNodeBySourceOffset(parseResult.nodes, comment.sourceStart);
          paragraphId = node?.paragraphId ?? null;
        }

        if (!paragraphId && comment.anchorText) {
          const node = findNodeByAnchorText(parseResult.nodes, comment.anchorText);
          paragraphId = node?.paragraphId ?? null;
        }

        if (!paragraphId && comment.lineNumber != null) {
          const offset = lineNumberToOffset(latexSource, comment.lineNumber);
          if (offset != null) {
            const node = findNodeBySourceOffset(parseResult.nodes, offset);
            paragraphId = node?.paragraphId ?? null;
          }
        }

        const key = paragraphId ?? "__unanchored__";
        if (!map[key]) map[key] = [];
        map[key].push(comment);
      }

      return map;
    }, [comments, parseResult.nodes, latexSource]);

    const commentCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      for (const [pid, cs] of Object.entries(commentsByParagraph)) {
        counts[pid] = cs.length;
      }
      return counts;
    }, [commentsByParagraph]);

    const buildAnchorForParagraph = useCallback(
      (paragraphId: string): CommentAnchorPayload => {
        const node = findNodeById(parseResult.nodes, paragraphId);
        if (!node) {
          return {
            paragraphId,
            sourceStart: null,
            sourceEnd: null,
            lineNumber: null,
            anchorText: null,
          };
        }

        let sourceStart = node.sourceRange.start;
        let sourceEnd = node.sourceRange.end;

        if (
          highlightRange &&
          Math.max(sourceStart, highlightRange.start) < Math.min(sourceEnd, highlightRange.end)
        ) {
          sourceStart = Math.max(sourceStart, highlightRange.start);
          sourceEnd = Math.min(sourceEnd, highlightRange.end);
        }

        const anchorSlice = cleanAnchorText(latexSource.slice(sourceStart, sourceEnd));
        const fallbackText = cleanAnchorText(getPlainText(node));

        return {
          paragraphId,
          sourceStart,
          sourceEnd,
          lineNumber: offsetToLineNumber(latexSource, sourceStart),
          anchorText: anchorSlice || fallbackText || null,
        };
      },
      [parseResult.nodes, highlightRange, latexSource]
    );

    useEffect(() => {
      if (!activeCommentParagraph) return;
      setPendingAnchor(buildAnchorForParagraph(activeCommentParagraph));
    }, [activeCommentParagraph, buildAnchorForParagraph]);

    const handleAddComment = useCallback(
      (paragraphId: string) => {
        setActiveCommentParagraph(paragraphId);
        setCommentText("");
        setPendingAnchor((prev) => {
          if (
            prev &&
            prev.paragraphId === paragraphId &&
            prev.sourceStart != null &&
            prev.sourceEnd != null
          ) {
            return prev;
          }
          return buildAnchorForParagraph(paragraphId);
        });
      },
      [buildAnchorForParagraph]
    );

    const handleSubmitComment = useCallback(() => {
      if (!commentText.trim()) return;

      const fallbackAnchor = activeCommentParagraph
        ? buildAnchorForParagraph(activeCommentParagraph)
        : null;
      const anchor = pendingAnchor ?? fallbackAnchor;

      if (!anchor) return;

      onAddComment(commentText.trim(), anchor);
      setActiveCommentParagraph(null);
      setCommentText("");
      setPendingAnchor(null);
    }, [commentText, activeCommentParagraph, pendingAnchor, buildAnchorForParagraph, onAddComment]);

    const handleParagraphClick = useCallback(
      (paragraphId: string) => {
        if (commentsByParagraph[paragraphId]?.length) {
          setActiveCommentParagraph((prev) => (prev === paragraphId ? null : paragraphId));
        }
      },
      [commentsByParagraph]
    );

    const handleRenderedSelection = useCallback(() => {
      if (!onSelectionChange || typeof window === "undefined") return;

      const root = containerRef.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;

      const mapped = mapRenderedSelectionToSource(
        range,
        root,
        parseResult.nodes,
        latexSource
      );

      if (!mapped) return;

      onSelectionChange({ start: mapped.start, end: mapped.end });
      setPendingAnchor({
        paragraphId: mapped.paragraphId,
        sourceStart: mapped.start,
        sourceEnd: mapped.end,
        lineNumber: offsetToLineNumber(latexSource, mapped.start),
        anchorText: mapped.anchorText,
      });
    }, [onSelectionChange, parseResult.nodes, latexSource]);

    return (
      <div
        ref={setContainerRef}
        className="h-full bg-[#e8dfd0] overflow-y-auto relative"
        onScroll={onScroll}
        onMouseUp={handleRenderedSelection}
        onKeyUp={handleRenderedSelection}
      >
        <div className="min-h-full py-8 px-5">
          <div className="mx-auto max-w-[900px]">
            <div className="mx-auto w-full max-w-[760px] bg-white border border-[#d9d0c2] shadow-[0_20px_48px_rgba(36,28,18,0.18)]">
              <div className="px-[72px] py-[84px]">
                <RenderedLatex
                  parseResult={parseResult}
                  editable={editable}
                  onParagraphEdit={onParagraphEdit}
                  onParagraphClick={handleParagraphClick}
                  commentCounts={commentCounts}
                  onAddComment={handleAddComment}
                  highlightRange={highlightRange}
                />
              </div>
            </div>

            {commentsByParagraph["__unanchored__"]?.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#d3c9ba] max-w-[760px] mx-auto">
                <p
                  className="text-[12px] uppercase tracking-wider text-[var(--muted)] mb-3"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  General Comments
                </p>
                <div className="space-y-2">
                  {commentsByParagraph["__unanchored__"].map((c) => (
                    <CommentThread key={c.id} comment={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {activeCommentParagraph && (
          <div className="fixed bottom-4 right-4 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-4 z-50">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[13px] text-[var(--muted)]"
                style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
              >
                Add comment
              </span>
              <button
                onClick={() => setActiveCommentParagraph(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-[16px]"
              >
                x
              </button>
            </div>

            {pendingAnchor?.anchorText && (
              <p
                className="text-[12px] text-[var(--muted)] bg-[var(--surface-warm)] border border-[var(--border)] rounded-md px-2 py-1 mb-2 line-clamp-2"
                title={pendingAnchor.anchorText}
              >
                "{pendingAnchor.anchorText}"
              </p>
            )}

            {commentsByParagraph[activeCommentParagraph]?.map((c) => (
              <CommentThread key={c.id} comment={c} compact />
            ))}

            <div className="flex gap-2 mt-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitComment();
                }}
                placeholder="Write a comment..."
                className="flex-1 bg-[var(--background-warm)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[var(--accent-muted)]"
                style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                autoFocus
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="px-3 py-2 bg-[var(--accent)] text-white text-[13px] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all"
                style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

function mapRenderedSelectionToSource(
  range: Range,
  root: HTMLElement,
  nodes: LatexNode[],
  latexSource: string
): {
  start: number;
  end: number;
  paragraphId: string | null;
  anchorText: string | null;
} | null {
  const startParagraphId = findParagraphIdFromNode(range.startContainer, root);
  const endParagraphId = findParagraphIdFromNode(range.endContainer, root);
  const selectedText = cleanAnchorText(range.toString());

  if (startParagraphId && endParagraphId && startParagraphId === endParagraphId) {
    const paragraphNode = findNodeById(nodes, startParagraphId);
    if (!paragraphNode) return null;

    if (selectedText) {
      const plainRange = findPlainTextRangeInNode(paragraphNode, selectedText);
      if (plainRange) {
        const mapped = mapPlainRangeToSource(
          latexSource,
          paragraphNode,
          plainRange.start,
          plainRange.end
        );
        if (mapped) {
          return {
            start: mapped.start,
            end: mapped.end,
            paragraphId: startParagraphId,
            anchorText: selectedText,
          };
        }
      }
    }

    return {
      start: paragraphNode.sourceRange.start,
      end: paragraphNode.sourceRange.end,
      paragraphId: paragraphNode.paragraphId,
      anchorText: selectedText || cleanAnchorText(getPlainText(paragraphNode)),
    };
  }

  const startNode = startParagraphId ? findNodeById(nodes, startParagraphId) : null;
  const endNode = endParagraphId ? findNodeById(nodes, endParagraphId) : null;

  if (startNode && endNode) {
    return {
      start: Math.min(startNode.sourceRange.start, endNode.sourceRange.start),
      end: Math.max(startNode.sourceRange.end, endNode.sourceRange.end),
      paragraphId: startNode.paragraphId,
      anchorText: selectedText || null,
    };
  }

  const startFromData = readSourceOffsetFromDom(range.startContainer, root, true);
  const endFromData = readSourceOffsetFromDom(range.endContainer, root, false);
  if (startFromData != null && endFromData != null && startFromData < endFromData) {
    const node = findNodeBySourceOffset(nodes, startFromData);
    return {
      start: startFromData,
      end: endFromData,
      paragraphId: node?.paragraphId ?? null,
      anchorText: selectedText || null,
    };
  }

  return null;
}

function findParagraphIdFromNode(node: Node, root: HTMLElement): string | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      const pid = current.getAttribute("data-paragraph-id");
      if (pid) return pid;
      if (current === root) return null;
    }
    current = current.parentNode;
  }
  return null;
}

function readSourceOffsetFromDom(
  node: Node,
  root: HTMLElement,
  preferStart: boolean
): number | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      const start = current.getAttribute("data-source-start");
      const end = current.getAttribute("data-source-end");
      if (start != null && end != null) {
        const parsedStart = Number(start);
        const parsedEnd = Number(end);
        if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
          return preferStart ? parsedStart : parsedEnd;
        }
      }
      if (current === root) return null;
    }
    current = current.parentNode;
  }
  return null;
}

function cleanAnchorText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function lineNumberToOffset(source: string, lineNumber: number): number | null {
  if (lineNumber < 1) return null;
  if (lineNumber === 1) return 0;

  let line = 1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      if (line === lineNumber) return i + 1;
    }
  }

  return line === lineNumber ? source.length : null;
}

function offsetToLineNumber(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}
