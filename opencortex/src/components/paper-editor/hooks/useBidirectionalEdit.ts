"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { parseLatex } from "../latex-parser/parser";
import { applyRenderedEdit, findNodeById } from "../latex-parser/source-map";
import { ParseResult } from "../latex-parser/types";

export function useBidirectionalEdit(initialLatex: string) {
  const [latex, setLatex] = useState(initialLatex);
  const latexRef = useRef(initialLatex);

  // Re-sync when paper data changes from outside (e.g. real-time update)
  const resetLatex = useCallback((newLatex: string) => {
    setLatex(newLatex);
    latexRef.current = newLatex;
  }, []);

  // Parse LaTeX into AST (memoized - only re-parses when latex changes)
  const parseResult: ParseResult = useMemo(() => {
    return parseLatex(latex);
  }, [latex]);

  // Update from LaTeX source pane (left side)
  const updateFromSource = useCallback((newLatex: string) => {
    setLatex(newLatex);
    latexRef.current = newLatex;
  }, []);

  // Update from rendered view (right side)
  const updateFromRendered = useCallback(
    (paragraphId: string, newText: string) => {
      const currentLatex = latexRef.current;
      // Re-parse to get fresh node positions
      const currentParse = parseLatex(currentLatex);
      const targetNode = findNodeById(currentParse.nodes, paragraphId);
      if (!targetNode) return;

      const updated = applyRenderedEdit(currentLatex, targetNode, newText);
      if (updated !== currentLatex) {
        setLatex(updated);
        latexRef.current = updated;
      }
    },
    []
  );

  const isDirty = latex !== initialLatex;

  return {
    latex,
    setLatex: updateFromSource,
    resetLatex,
    parseResult,
    updateFromRendered,
    isDirty,
  };
}
