"use client";

import { formatDistanceToNow } from "date-fns";

export default function TimeAgo({ date }: { date: string | Date }) {
  return (
    <span 
      className="text-[13px] text-[var(--muted)]"
      style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif", fontStyle: "italic" }}
    >
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </span>
  );
}
