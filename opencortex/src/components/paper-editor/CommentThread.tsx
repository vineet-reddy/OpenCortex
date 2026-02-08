"use client";

import Avatar from "../Avatar";
import TimeAgo from "../TimeAgo";

interface Comment {
  id: string;
  content: string;
  resolved: boolean;
  author: { name: string; handle: string; avatar: string | null };
  createdAt: string;
}

interface CommentThreadProps {
  comment: Comment;
  compact?: boolean;
  onResolve?: (id: string) => void;
}

export function CommentThread({ comment, compact, onResolve }: CommentThreadProps) {
  if (compact) {
    return (
      <div
        className={`flex gap-2 py-2 ${
          comment.resolved ? "opacity-50" : ""
        }`}
      >
        <Avatar
          initials={comment.author.avatar || comment.author.name.charAt(0)}
          name={comment.author.name}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] font-medium truncate"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
            >
              {comment.author.name}
            </span>
            <TimeAgo date={comment.createdAt} />
          </div>
          <p
            className="text-[13px] text-[var(--foreground-soft)] leading-snug mt-0.5"
            style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
          >
            {comment.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-2xl p-4 ${
        comment.resolved
          ? "border-[var(--border)]/50 opacity-60"
          : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          initials={comment.author.avatar || comment.author.name.charAt(0)}
          name={comment.author.name}
          size="sm"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[14px]"
              style={{
                fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
                fontWeight: 500,
              }}
            >
              {comment.author.name}
            </span>
            <TimeAgo date={comment.createdAt} />
            {comment.resolved && (
              <span className="text-[10px] text-[var(--success)] uppercase tracking-wider" style={{ fontFamily: "var(--font-mono), monospace" }}>
                resolved
              </span>
            )}
          </div>
          <p
            className="text-[15px] mt-2 leading-relaxed text-[var(--foreground-soft)]"
            style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
          >
            {comment.content}
          </p>
          {onResolve && !comment.resolved && (
            <button
              onClick={() => onResolve(comment.id)}
              className="mt-2 text-[12px] text-[var(--muted)] hover:text-[var(--success)] transition-colors"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
