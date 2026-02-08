export interface SourceRange {
  start: number;
  end: number;
}

export type LatexNodeType =
  | "preamble"
  | "title"
  | "author"
  | "date"
  | "maketitle"
  | "abstract"
  | "section"
  | "subsection"
  | "subsubsection"
  | "paragraph"
  | "enumerate"
  | "itemize"
  | "item"
  | "textbf"
  | "textit"
  | "emph"
  | "textsuperscript"
  | "textsubscript"
  | "underline"
  | "math-inline"
  | "math-display"
  | "text"
  | "newline"
  | "comment"
  | "unknown-command";

export interface LatexNode {
  type: LatexNodeType;
  content: string;
  children: LatexNode[];
  sourceRange: SourceRange;
  paragraphId: string;
  renderedText?: string;
}

export interface ParseResult {
  nodes: LatexNode[];
  metadata: {
    title: string;
    authors: string;
    date: string;
  };
  preamble: string;
}
