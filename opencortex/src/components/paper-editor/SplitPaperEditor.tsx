"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Avatar from "../Avatar";
import TimeAgo from "../TimeAgo";
import { usePaperData } from "./hooks/usePaperData";
import { useBidirectionalEdit } from "./hooks/useBidirectionalEdit";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { LatexSourcePane, LatexSourcePaneRef } from "./LatexSourcePane";
import { RenderedDocPane } from "./RenderedDocPane";
import { EditsPanel } from "./EditsPanel";
import { CommentThread } from "./CommentThread";
import { LatexNode } from "./latex-parser/types";

interface SplitPaperEditorProps {
  paperId: string;
  onBack: () => void;
}

export default function SplitPaperEditor({ paperId, onBack }: SplitPaperEditorProps) {
  const { paper, setPaper, loading, refetch } = usePaperData(paperId);
  const {
    latex,
    setLatex,
    resetLatex,
    parseResult,
    updateFromRendered,
    isDirty,
  } = useBidirectionalEdit(paper?.latexSource ?? "");
  const [editMode, setEditMode] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<"split" | "comments" | "edits">("split");
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);

  // Refs for scroll sync
  const sourceRef = useRef<LatexSourcePaneRef>(null);
  const renderedRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build line offset map for scroll sync
  const lineOffsets = useMemo(() => {
    const offsets: number[] = [0];
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === "\n") {
        offsets.push(i + 1);
      }
    }
    return offsets;
  }, [latex]);

  // Find node containing a character offset
  const findNodeAtOffset = useCallback((offset: number): LatexNode | null => {
    function search(nodes: LatexNode[]): LatexNode | null {
      for (const node of nodes) {
        if (offset >= node.sourceRange.start && offset <= node.sourceRange.end) {
          const childMatch = search(node.children);
          if (childMatch) return childMatch;
          return node;
        }
      }
      return null;
    }
    return search(parseResult.nodes);
  }, [parseResult.nodes]);

  // Handle source pane scroll -> sync to rendered
  const handleSourceScroll = useCallback(() => {
    if (!scrollSyncEnabled || isSyncingRef.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      const textarea = sourceRef.current?.textarea;
      const container = renderedRef.current;
      if (!textarea || !container) return;

      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20.8;
      const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 16;
      const lineNumber = Math.max(1, Math.floor((textarea.scrollTop - paddingTop + lineHeight / 2) / lineHeight) + 1);
      
      const idx = Math.min(lineNumber - 1, lineOffsets.length - 1);
      const charOffset = lineOffsets[idx] ?? 0;
      const node = findNodeAtOffset(charOffset);

      if (node) {
        const element = container.querySelector(`[data-paragraph-id="${node.paragraphId}"]`);
        if (element) {
          isSyncingRef.current = true;
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const offsetInContainer = elementRect.top - containerRect.top + container.scrollTop;
          
          container.scrollTo({
            top: Math.max(0, offsetInContainer - 60),
            behavior: "smooth",
          });

          setTimeout(() => { isSyncingRef.current = false; }, 300);
        }
      }
    }, 50);
  }, [scrollSyncEnabled, lineOffsets, findNodeAtOffset]);

  // Handle rendered pane scroll -> sync to source
  const handleRenderedScroll = useCallback(() => {
    if (!scrollSyncEnabled || isSyncingRef.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      const textarea = sourceRef.current?.textarea;
      const container = renderedRef.current;
      if (!textarea || !container) return;

      const containerRect = container.getBoundingClientRect();
      const elements = container.querySelectorAll("[data-paragraph-id]");
      
      let topElement: Element | null = null;
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= containerRect.top - 50) {
          topElement = el;
          break;
        }
      }

      if (!topElement) return;

      const paragraphId = topElement.getAttribute("data-paragraph-id");
      if (!paragraphId) return;

      // Find the node
      function findNode(nodes: LatexNode[]): LatexNode | null {
        for (const n of nodes) {
          if (n.paragraphId === paragraphId) return n;
          const child = findNode(n.children);
          if (child) return child;
        }
        return null;
      }

      const node = findNode(parseResult.nodes);
      if (!node) return;

      // Find line number
      const offset = node.sourceRange.start;
      let lineNumber = 1;
      for (let i = 0; i < lineOffsets.length; i++) {
        if (lineOffsets[i] <= offset) lineNumber = i + 1;
        else break;
      }

      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20.8;
      const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 16;
      const targetScrollTop = paddingTop + (lineNumber - 1) * lineHeight;

      isSyncingRef.current = true;
      textarea.scrollTo({
        top: Math.max(0, targetScrollTop - 40),
        behavior: "smooth",
      });

      setTimeout(() => { isSyncingRef.current = false; }, 300);
    }, 50);
  }, [scrollSyncEnabled, parseResult.nodes, lineOffsets]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Sync initial paper data to editor
  useEffect(() => {
    if (paper) {
      resetLatex(paper.latexSource);
    }
  }, [paper?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time sync
  const { connected } = useRealtimeSync(paperId, useCallback((updated) => {
    // Only apply remote updates if user hasn't made local edits
    if (!isDirty) {
      setPaper(updated);
      resetLatex(updated.latexSource);
    }
  }, [isDirty, setPaper, resetLatex]));

  const submitEdit = async () => {
    if (!paper || latex === paper.latexSource) return;
    setSaving(true);
    await fetch(`/api/papers/${paperId}/edits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldContent: paper.latexSource,
        newContent: latex,
        description: editDescription || "Updated paper content",
      }),
    });
    setSaving(false);
    setEditMode(false);
    setEditDescription("");
    refetch();
  };

  const addComment = async (content: string, paragraphId: string, anchorText: string) => {
    await fetch(`/api/papers/${paperId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, anchorText }),
    });
    refetch();
  };

  if (loading || !paper) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-5">
          <div className="h-8 bg-[var(--border)] rounded-full w-1/3" />
          <div className="h-[600px] bg-[var(--border)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[14px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors duration-300"
          style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Papers
        </button>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono), monospace" }}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--muted-soft)]"}`} />
            {connected ? "Live" : "Offline"}
          </span>

          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-5 py-2 bg-[var(--accent)] text-white text-[15px] rounded-full hover:bg-[var(--accent-hover)] transition-all duration-300 shadow-sm"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
            >
              Edit Paper
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  resetLatex(paper.latexSource);
                  setEditDescription("");
                }}
                className="px-5 py-2 border border-[var(--border)] text-[15px] rounded-full hover:bg-[var(--surface-hover)] transition-all duration-300"
                style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={saving || !isDirty}
                className="px-5 py-2 bg-[var(--success)] text-white text-[15px] rounded-full hover:bg-[#3d6949] disabled:opacity-40 transition-all duration-300 shadow-sm"
                style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
              >
                {saving ? "Saving..." : "Submit Edit"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Paper title & meta */}
      <div className="mb-5">
        <h1 className="text-2xl leading-snug" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 600 }}>
          {paper.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <div className="flex -space-x-2">
            {paper.authors.map((a) => (
              <Avatar
                key={a.user.id}
                initials={a.user.avatar || a.user.name.charAt(0)}
                name={a.user.name}
                size="sm"
              />
            ))}
          </div>
          <span className="text-[14px] text-[var(--muted)]" style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif", fontStyle: "italic" }}>
            {paper.authors.map((a) => a.user.name).join(", ")}
          </span>
          <span className="text-[var(--border)]">·</span>
          <TimeAgo date={paper.updatedAt} />
        </div>
      </div>

      {/* Edit description when in edit mode */}
      {editMode && (
        <input
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Describe your changes..."
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[var(--accent-muted)] transition-colors mb-5"
          style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-[var(--border)]">
        {([
          { key: "split" as const, label: "Split View" },
          { key: "comments" as const, label: `Comments (${paper.comments.length})` },
          { key: "edits" as const, label: `Edits (${paper.edits.length})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActivePanel(tab.key)}
            className={`px-4 py-2.5 text-[15px] transition-all duration-300 border-b-2 ${
              activePanel === tab.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Split View */}
      {activePanel === "split" && (
        <div className="border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>
          <div className="grid grid-cols-2 h-full">
            {/* Left: LaTeX Source */}
            <div className="border-r border-[var(--border)] overflow-hidden flex flex-col">
              <div className="px-4 py-2 bg-[var(--surface-warm)] border-b border-[var(--border)] flex items-center justify-between flex-none">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                    LaTeX Source
                  </span>
                  <button
                    onClick={() => setScrollSyncEnabled(!scrollSyncEnabled)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                      scrollSyncEnabled 
                        ? "bg-[var(--accent-light)] text-[var(--accent)]" 
                        : "bg-[var(--surface-hover)] text-[var(--muted)]"
                    }`}
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                    title={scrollSyncEnabled ? "Scroll sync on" : "Scroll sync off"}
                  >
                    {scrollSyncEnabled ? "Sync" : "Sync off"}
                  </button>
                </div>
                {isDirty && (
                  <span className="text-[11px] text-[var(--warning)] px-2 py-0.5 rounded-full bg-[var(--warning-light)]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                    modified
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <LatexSourcePane
                  ref={sourceRef}
                  latex={latex}
                  onChange={setLatex}
                  readOnly={!editMode}
                  onScroll={handleSourceScroll}
                />
              </div>
            </div>

            {/* Right: Rendered Document */}
            <div className="overflow-hidden flex flex-col">
              <div className="px-4 py-2 bg-white border-b border-[var(--border)] flex items-center justify-between flex-none">
                <span className="text-[12px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                  Rendered Paper
                </span>
                <span className="text-[11px] text-[var(--muted-soft)]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                  {editMode ? "Click text to edit" : "Read only"}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <RenderedDocPane
                  ref={renderedRef}
                  parseResult={parseResult}
                  editable={editMode}
                  onParagraphEdit={updateFromRendered}
                  comments={paper.comments}
                  onAddComment={addComment}
                  onScroll={handleRenderedScroll}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments Panel */}
      {activePanel === "comments" && (
        <div className="space-y-4">
          {paper.comments.length === 0 ? (
            <p
              className="text-[15px] text-[var(--muted)] text-center py-12"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif", fontStyle: "italic" }}
            >
              No comments yet. Open Split View and click the + icon next to any paragraph to add a comment.
            </p>
          ) : (
            paper.comments.map((comment) => (
              <CommentThread key={comment.id} comment={comment} />
            ))
          )}

          {/* Quick add comment */}
          <div className="flex gap-3 pt-3">
            <QuickComment paperId={paperId} onCommented={refetch} />
          </div>
        </div>
      )}

      {/* Edits Panel */}
      {activePanel === "edits" && (
        <EditsPanel edits={paper.edits} />
      )}
    </div>
  );
}

function QuickComment({ paperId, onCommented }: { paperId: string; onCommented: () => void }) {
  const [text, setText] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    await fetch(`/api/papers/${paperId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setText("");
    onCommented();
  };

  return (
    <>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Add a comment..."
        className="flex-1 bg-[var(--surface-warm)] border border-[var(--border)] rounded-full px-5 py-2.5 text-[15px] outline-none focus:border-[var(--accent-muted)] transition-colors"
        style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
      />
      <button
        onClick={submit}
        className="px-5 py-2.5 bg-[var(--accent)] text-white text-[15px] rounded-full hover:bg-[var(--accent-hover)] transition-all duration-300"
        style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
      >
        Comment
      </button>
    </>
  );
}
