"use client";

import { useState, useEffect, useCallback } from "react";
import Avatar from "./Avatar";
import TimeAgo from "./TimeAgo";

interface Author {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
}

interface Comment {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
}

interface LinkedPaper {
  paper: {
    id: string;
    title: string;
    status: string;
  };
}

interface Idea {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
  comments: Comment[];
  linkedPapers: LinkedPaper[];
  _count: { comments: number };
}

export default function IdeasFeed() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdea, setNewIdea] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});

  const fetchIdeas = useCallback(async () => {
    const res = await fetch("/api/ideas");
    const data = await res.json();
    setIdeas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const postIdea = async () => {
    if (!newIdea.trim()) return;
    setPosting(true);
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newIdea }),
    });
    setNewIdea("");
    setPosting(false);
    fetchIdeas();
  };

  const postComment = async (ideaId: string) => {
    const content = commentTexts[ideaId];
    if (!content?.trim()) return;
    await fetch(`/api/ideas/${ideaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setCommentTexts((prev) => ({ ...prev, [ideaId]: "" }));
    fetchIdeas();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Compose box */}
      <div className="border border-[var(--border)] rounded-2xl p-5 mb-8 bg-[var(--surface)] shadow-sm">
        <textarea
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          placeholder="Share a scientific idea... What if we tried X for Y?"
          className="w-full bg-transparent text-[var(--foreground)] resize-none outline-none text-[16px] leading-relaxed min-h-[100px]"
          style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) postIdea();
          }}
        />
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-light)]">
          <span className="text-sm text-[var(--muted)]" style={{ fontFamily: "var(--font-mono), monospace", fontSize: "12px" }}>
            {newIdea.length > 0 && `${newIdea.length} characters`}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--muted-soft)]" style={{ fontFamily: "var(--font-mono), monospace" }}>⌘ Enter</span>
            <button
              onClick={postIdea}
              disabled={posting || !newIdea.trim()}
              className="px-5 py-2 bg-[var(--accent)] text-white text-[15px] rounded-full hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
            >
              {posting ? "Posting..." : "Post Idea"}
            </button>
          </div>
        </div>
      </div>

      {/* Ideas stream */}
      {loading ? (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-[var(--border)] rounded-2xl p-5 animate-pulse bg-[var(--surface)]">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--border)]" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-[var(--border)] rounded-full w-1/3" />
                  <div className="h-4 bg-[var(--border)] rounded-full w-full" />
                  <div className="h-4 bg-[var(--border)] rounded-full w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {ideas.map((idea) => (
            <article
              key={idea.id}
              className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] hover:border-[var(--accent-muted)] transition-all duration-300 shadow-sm hover:shadow-md"
            >
              {/* Author row */}
              <div className="flex items-start gap-4">
                <Avatar
                  initials={idea.author.avatar || idea.author.name.charAt(0)}
                  name={idea.author.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px]" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 600 }}>
                      {idea.author.name}
                    </span>
                    <span className="text-[var(--muted)] text-[13px]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                      @{idea.author.handle}
                    </span>
                    <span className="text-[var(--border)]">·</span>
                    <TimeAgo date={idea.createdAt} />
                  </div>
                  <p className="mt-2.5 text-[16px] leading-[1.7] whitespace-pre-wrap text-[var(--foreground-soft)]" style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}>
                    {idea.content}
                  </p>

                  {/* Linked papers */}
                  {idea.linkedPapers.length > 0 && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                      {idea.linkedPapers.map((lp) => (
                        <span
                          key={lp.paper.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-[13px] border border-[var(--accent)]/15"
                          style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {lp.paper.title.substring(0, 40)}...
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-5">
                    <button
                      onClick={() =>
                        setExpandedIdea(expandedIdea === idea.id ? null : idea.id)
                      }
                      className="flex items-center gap-2 text-[14px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors duration-300"
                      style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {idea._count.comments} {idea._count.comments === 1 ? "reply" : "replies"}
                    </button>
                    {idea.linkedPapers.length === 0 && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/ideas/${idea.id}/link-paper`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({}),
                          });
                          fetchIdeas();
                        }}
                        className="flex items-center gap-2 text-[14px] text-[var(--muted)] hover:text-[var(--success)] transition-colors duration-300"
                        style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                        Start Paper
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Comments thread */}
              {expandedIdea === idea.id && (
                <div className="mt-5 ml-14 space-y-4 border-l-2 border-[var(--accent-light)] pl-5">
                  {idea.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <Avatar
                        initials={comment.author.avatar || comment.author.name.charAt(0)}
                        name={comment.author.name}
                        size="sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 500 }}>
                            {comment.author.name}
                          </span>
                          <span className="text-[var(--muted)] text-[11px]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                            @{comment.author.handle}
                          </span>
                          <TimeAgo date={comment.createdAt} />
                        </div>
                        <p className="text-[14px] text-[var(--foreground-soft)] mt-1 leading-relaxed" style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}>
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Reply box */}
                  <div className="flex gap-3 pt-3">
                    <input
                      value={commentTexts[idea.id] || ""}
                      onChange={(e) =>
                        setCommentTexts((prev) => ({
                          ...prev,
                          [idea.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") postComment(idea.id);
                      }}
                      placeholder="Add a reply..."
                      className="flex-1 bg-[var(--background-warm)] border border-[var(--border)] rounded-full px-4 py-2 text-[14px] outline-none focus:border-[var(--accent-muted)] transition-colors"
                      style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                    />
                    <button
                      onClick={() => postComment(idea.id)}
                      className="px-4 py-2 bg-[var(--accent)] text-white text-[14px] rounded-full hover:bg-[var(--accent-hover)] transition-colors"
                      style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
