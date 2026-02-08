"use client";

import Avatar from "../Avatar";
import TimeAgo from "../TimeAgo";
import { PaperEdit } from "./hooks/usePaperData";

interface EditsPanelProps {
  edits: PaperEdit[];
  onAccept?: (editId: string) => void;
  onReject?: (editId: string) => void;
}

export function EditsPanel({ edits, onAccept, onReject }: EditsPanelProps) {
  if (edits.length === 0) {
    return (
      <p
        className="text-[15px] text-[var(--muted)] text-center py-12"
        style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif", fontStyle: "italic" }}
      >
        No edits yet. Click &quot;Edit Paper&quot; to suggest changes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {edits.map((edit) => (
        <div
          key={edit.id}
          className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)] shadow-sm"
        >
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-warm)]">
            <div className="flex items-center gap-3">
              <Avatar
                initials={edit.author.avatar || edit.author.name.charAt(0)}
                name={edit.author.name}
                size="sm"
              />
              <span
                className="text-[14px]"
                style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 500 }}
              >
                {edit.author.name}
              </span>
              <TimeAgo date={edit.createdAt} />
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide ${
                  edit.status === "accepted"
                    ? "bg-[var(--success-light)] text-[var(--success)]"
                    : edit.status === "rejected"
                    ? "bg-red-50 text-red-700"
                    : "bg-[var(--warning-light)] text-amber-800"
                }`}
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {edit.status}
              </span>
              {edit.status === "pending" && onAccept && onReject && (
                <>
                  <button
                    onClick={() => onAccept(edit.id)}
                    className="px-3 py-1 text-[12px] bg-[var(--success)] text-white rounded-full hover:bg-[#3d6949] transition-all"
                    style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onReject(edit.id)}
                    className="px-3 py-1 text-[12px] border border-red-300 text-red-600 rounded-full hover:bg-red-50 transition-all"
                    style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
          {edit.description && (
            <div
              className="px-4 py-3 text-[14px] text-[var(--muted)] border-b border-[var(--border)]"
              style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif", fontStyle: "italic" }}
            >
              {edit.description}
            </div>
          )}
          <div
            className="p-4 text-[12px] max-h-48 overflow-auto bg-[var(--background-warm)]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            <div className="text-red-600/70 line-through">
              {edit.oldContent.substring(0, 200)}...
            </div>
            <div className="text-[var(--success)] mt-2">
              {edit.newContent.substring(0, 200)}...
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
