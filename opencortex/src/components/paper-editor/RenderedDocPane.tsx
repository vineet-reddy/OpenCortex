"use client";

import { useState, useCallback, useMemo, forwardRef } from "react";
import { ParseResult } from "./latex-parser/types";
import { RenderedLatex } from "./latex-parser/renderer";
import { PaperComment } from "./hooks/usePaperData";
import { getPlainText } from "./latex-parser/parser";
import { findNodeByAnchorText } from "./latex-parser/source-map";
import { CommentThread } from "./CommentThread";

interface RenderedDocPaneProps {
  parseResult: ParseResult;
  editable: boolean;
  onParagraphEdit: (paragraphId: string, newText: string) => void;
  comments: PaperComment[];
  onAddComment: (content: string, paragraphId: string, anchorText: string) => void;
  onScroll?: () => void;
}

export const RenderedDocPane = forwardRef<HTMLDivElement, RenderedDocPaneProps>(
  function RenderedDocPane({
  parseResult,
  editable,
  onParagraphEdit,
  comments,
  onAddComment,
  onScroll,
}, ref) {
  const [activeCommentParagraph, setActiveCommentParagraph] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Map comments to paragraphs using anchorText or lineNumber
  const commentsByParagraph = useMemo(() => {
    const map: Record<string, PaperComment[]> = {};
    for (const comment of comments) {
      let pid: string | null = null;

      // Try anchorText first
      if (comment.anchorText) {
        const node = findNodeByAnchorText(parseResult.nodes, comment.anchorText);
        if (node) pid = node.paragraphId;
      }

      // Fall back to lineNumber -> find paragraph containing that line
      if (!pid && comment.lineNumber != null) {
        const offset = lineNumberToOffset(parseResult, comment.lineNumber);
        if (offset !== null) {
          for (const n of parseResult.nodes) {
            if (n.sourceRange.start <= offset && n.sourceRange.end >= offset) {
              pid = n.paragraphId;
              break;
            }
          }
        }
      }

      // If still no match, put in a general bucket
      if (!pid) pid = "__unanchored__";

      if (!map[pid]) map[pid] = [];
      map[pid].push(comment);
    }
    return map;
  }, [comments, parseResult]);

  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [pid, cs] of Object.entries(commentsByParagraph)) {
      counts[pid] = cs.length;
    }
    return counts;
  }, [commentsByParagraph]);

  const handleAddComment = useCallback(
    (paragraphId: string) => {
      setActiveCommentParagraph(paragraphId);
      setCommentText("");
    },
    []
  );

  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim() || !activeCommentParagraph) return;

    // Get anchor text from the paragraph
    let anchorText = "";
    for (const n of parseResult.nodes) {
      if (n.paragraphId === activeCommentParagraph) {
        anchorText = getPlainText(n).slice(0, 100);
        break;
      }
      for (const child of n.children) {
        if (child.paragraphId === activeCommentParagraph) {
          anchorText = getPlainText(child).slice(0, 100);
          break;
        }
      }
    }

    onAddComment(commentText, activeCommentParagraph, anchorText);
    setActiveCommentParagraph(null);
    setCommentText("");
  }, [commentText, activeCommentParagraph, parseResult, onAddComment]);

  const handleParagraphClick = useCallback(
    (paragraphId: string) => {
      // If there are comments for this paragraph, toggle showing them
      if (commentsByParagraph[paragraphId]?.length) {
        setActiveCommentParagraph(
          activeCommentParagraph === paragraphId ? null : paragraphId
        );
      }
    },
    [commentsByParagraph, activeCommentParagraph]
  );

  return (
    <div ref={ref} className="h-full bg-white overflow-y-auto relative" onScroll={onScroll}>
      <div className="max-w-[680px] mx-auto px-10 py-8">
        <RenderedLatex
          parseResult={parseResult}
          editable={editable}
          onParagraphEdit={onParagraphEdit}
          onParagraphClick={handleParagraphClick}
          commentCounts={commentCounts}
          onAddComment={handleAddComment}
        />

        {/* Unanchored comments */}
        {commentsByParagraph["__unanchored__"]?.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
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

      {/* Active comment input popover */}
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

          {/* Show existing comments for this paragraph */}
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
});

/** Convert a 1-based line number to a character offset in the full LaTeX source */
function lineNumberToOffset(parseResult: ParseResult, lineNumber: number): number | null {
  // Reconstruct from preamble to get total source
  // This is approximate - we use the first node's start as base
  const nodes = parseResult.nodes;
  if (nodes.length === 0) return null;

  // Count newlines from the start of the first node
  let currentLine = 1;
  const baseOffset = nodes[0].sourceRange.start;

  // We can't easily get the full source here, so just use lineNumber as a rough offset
  // Each line is ~80 chars average
  return baseOffset + (lineNumber - 1) * 80;
}
