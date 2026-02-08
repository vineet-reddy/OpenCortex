import { LatexNode } from "./types";
import { getPlainText } from "./parser";

/**
 * Apply a rendered-view edit back to the LaTeX source.
 * Replaces the text content within the node's source range while
 * attempting to preserve inline LaTeX formatting commands.
 */
export function applyRenderedEdit(
  fullLatex: string,
  targetNode: LatexNode,
  newPlainText: string
): string {
  const { start, end } = targetNode.sourceRange;
  const oldSlice = fullLatex.slice(start, end);

  // For section headings, replace just the braced content
  if (
    targetNode.type === "section" ||
    targetNode.type === "subsection" ||
    targetNode.type === "subsubsection"
  ) {
    const braceStart = oldSlice.indexOf("{");
    const braceEnd = oldSlice.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      const before = fullLatex.slice(0, start + braceStart + 1);
      const after = fullLatex.slice(start + braceEnd);
      return before + newPlainText + after;
    }
  }

  // For abstract, replace the content between \begin{abstract} and \end{abstract}
  if (targetNode.type === "abstract") {
    const beginTag = "\\begin{abstract}";
    const endTag = "\\end{abstract}";
    const beginIdx = oldSlice.indexOf(beginTag);
    const endIdx = oldSlice.indexOf(endTag);
    if (beginIdx >= 0 && endIdx > beginIdx) {
      const before = fullLatex.slice(0, start + beginIdx + beginTag.length);
      const after = fullLatex.slice(start + endIdx);
      return before + "\n" + newPlainText + "\n" + after;
    }
  }

  // For items, preserve the \item prefix
  if (targetNode.type === "item") {
    const itemMatch = oldSlice.match(/^\\item\s*/);
    if (itemMatch) {
      const prefix = itemMatch[0];
      return fullLatex.slice(0, start) + prefix + newPlainText + fullLatex.slice(end);
    }
  }

  // For paragraphs, try to do a smart replacement preserving inline commands
  // Strategy: diff old rendered text vs new rendered text, apply changes to raw LaTeX
  const oldRendered = getNodePlainText(targetNode);

  if (oldRendered === newPlainText) {
    // No actual change
    return fullLatex;
  }

  // Simple case: if no inline formatting commands, just replace
  if (!hasInlineCommands(oldSlice)) {
    return fullLatex.slice(0, start) + newPlainText + fullLatex.slice(end);
  }

  // Complex case: try to map the edit through formatting commands
  const newSlice = mapEditThroughFormatting(oldSlice, oldRendered, newPlainText);
  return fullLatex.slice(0, start) + newSlice + fullLatex.slice(end);
}

function getNodePlainText(n: LatexNode): string {
  return getPlainText(n).replace(/\s+/g, " ").trim();
}

function hasInlineCommands(latex: string): boolean {
  return /\\(textbf|textit|emph|textsuperscript|textsubscript|underline)\{/.test(latex);
}

/**
 * Map text edits through LaTeX formatting commands.
 * Given old LaTeX with commands, old plain text, and new plain text,
 * produce new LaTeX that preserves the commands but updates the text.
 */
function mapEditThroughFormatting(
  oldLatex: string,
  oldPlain: string,
  newPlain: string
): string {
  // Find the longest common prefix and suffix between old and new plain text
  let prefixLen = 0;
  while (
    prefixLen < oldPlain.length &&
    prefixLen < newPlain.length &&
    oldPlain[prefixLen] === newPlain[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < oldPlain.length - prefixLen &&
    suffixLen < newPlain.length - prefixLen &&
    oldPlain[oldPlain.length - 1 - suffixLen] === newPlain[newPlain.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Map plain text offsets to LaTeX offsets
  const latexPrefixEnd = plainOffsetToLatex(oldLatex, prefixLen);
  const latexSuffixStart =
    suffixLen > 0
      ? plainOffsetToLatexFromEnd(oldLatex, suffixLen)
      : oldLatex.length;

  // The changed portion in the new plain text
  const newMiddle = newPlain.slice(prefixLen, newPlain.length - suffixLen);

  return (
    oldLatex.slice(0, latexPrefixEnd) +
    newMiddle +
    oldLatex.slice(latexSuffixStart)
  );
}

/**
 * Map a plain-text character offset to the corresponding position
 * in the LaTeX source, skipping over command sequences.
 */
function plainOffsetToLatex(latex: string, plainOffset: number): number {
  let pi = 0; // plain index
  let li = 0; // latex index

  while (li < latex.length && pi < plainOffset) {
    if (latex[li] === "\\") {
      // Check if it's a formatting command with braces
      const cmdMatch = latex.slice(li).match(
        /^\\(textbf|textit|emph|textsuperscript|textsubscript|underline)\{/
      );
      if (cmdMatch) {
        li += cmdMatch[0].length; // skip command + opening brace
        continue;
      }
      // Special char command like \%
      if (li + 1 < latex.length && !isLetter(latex[li + 1])) {
        li += 2;
        pi++;
        continue;
      }
      // Other command
      li++;
      while (li < latex.length && isLetter(latex[li])) li++;
      continue;
    }

    if (latex[li] === "}") {
      // Closing brace of a formatting command
      li++;
      continue;
    }

    if (latex[li] === "$") {
      // Math delimiters - include in plain text
      li++;
      pi++;
      continue;
    }

    if (latex[li] === "%" && (li === 0 || latex[li - 1] !== "\\")) {
      // Comment - skip to end of line
      while (li < latex.length && latex[li] !== "\n") li++;
      continue;
    }

    li++;
    pi++;
  }

  return li;
}

function plainOffsetToLatexFromEnd(latex: string, plainOffset: number): number {
  let pi = 0;
  let li = latex.length;

  while (li > 0 && pi < plainOffset) {
    li--;
    const ch = latex[li];

    if (ch === "}") {
      // Could be end of a formatting command arg, just count the char before
      pi++;
      continue;
    }

    if (ch === "{") {
      // Opening brace - check if it's part of a command
      const before = latex.slice(0, li);
      const cmdMatch = before.match(
        /\\(textbf|textit|emph|textsuperscript|textsubscript|underline)$/
      );
      if (cmdMatch) {
        li -= cmdMatch[0].length;
        continue;
      }
      pi++;
      continue;
    }

    pi++;
  }

  return li;
}

function isLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

/**
 * Find a node by paragraphId in the node tree
 */
export function findNodeById(
  nodes: LatexNode[],
  paragraphId: string
): LatexNode | null {
  for (const n of nodes) {
    if (n.paragraphId === paragraphId) return n;
    if (n.children.length > 0) {
      const found = findNodeById(n.children, paragraphId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find a node whose rendered text best matches the given anchor text.
 * Used for re-anchoring comments after edits.
 */
export function findNodeByAnchorText(
  nodes: LatexNode[],
  anchorText: string
): LatexNode | null {
  let bestMatch: LatexNode | null = null;
  let bestScore = 0;

  function search(nodeList: LatexNode[]) {
    for (const n of nodeList) {
      const plain = getPlainText(n);
      if (plain.includes(anchorText)) {
        const score = anchorText.length / plain.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = n;
        }
      }
      if (n.children.length > 0) search(n.children);
    }
  }

  search(nodes);
  return bestMatch;
}
