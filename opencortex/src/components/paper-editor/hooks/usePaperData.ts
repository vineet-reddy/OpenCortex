"use client";

import { useState, useEffect, useCallback } from "react";

interface Author {
  user: { id: string; name: string; handle: string; avatar: string | null };
}

export interface PaperComment {
  id: string;
  content: string;
  lineNumber: number | null;
  anchorText: string | null;
  resolved: boolean;
  author: { name: string; handle: string; avatar: string | null };
  createdAt: string;
}

export interface PaperEdit {
  id: string;
  oldContent: string;
  newContent: string;
  description: string | null;
  status: string;
  author: { name: string; handle: string; avatar: string | null };
  createdAt: string;
}

export interface PaperDetail {
  id: string;
  title: string;
  abstract: string;
  latexSource: string;
  status: string;
  score: number;
  createdAt: string;
  updatedAt: string;
  authors: Author[];
  comments: PaperComment[];
  edits: PaperEdit[];
}

export function usePaperData(paperId: string) {
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaper = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${paperId}`);
      if (!res.ok) throw new Error("Failed to fetch paper");
      const data = await res.json();
      setPaper(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  return { paper, setPaper, loading, error, refetch: fetchPaper };
}
