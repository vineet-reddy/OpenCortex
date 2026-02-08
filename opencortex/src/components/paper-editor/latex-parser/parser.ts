import { LatexNode, LatexNodeType, ParseResult, SourceRange } from "./types";

let pid = 0;
function nextId(offset: number): string {
  return `p-${offset}-${pid++}`;
}

function node(
  type: LatexNodeType,
  content: string,
  sourceRange: SourceRange,
  children: LatexNode[] = []
): LatexNode {
  return {
    type,
    content,
    children,
    sourceRange,
    paragraphId: nextId(sourceRange.start),
  };
}

/** Extract text between balanced braces starting at `pos` (which should be `{`). */
function extractBraced(src: string, pos: number): { text: string; end: number } | null {
  if (pos >= src.length || src[pos] !== "{") return null;
  let depth = 1;
  let i = pos + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{" && src[i - 1] !== "\\") depth++;
    else if (src[i] === "}" && src[i - 1] !== "\\") depth--;
    i++;
  }
  return { text: src.slice(pos + 1, i - 1), end: i };
}

/** Read a command name starting at `pos` (which should be `\`). */
function readCommand(src: string, pos: number): { name: string; end: number } {
  let i = pos + 1;
  if (i < src.length && !isLetter(src[i])) {
    // Single-char commands like \%, \$, \\
    return { name: src[i] || "", end: i + 1 };
  }
  while (i < src.length && isLetter(src[i])) i++;
  return { name: src.slice(pos + 1, i), end: i };
}

function isLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

/** Skip optional arguments like [utf8] */
function skipOptional(src: string, pos: number): number {
  if (pos < src.length && src[pos] === "[") {
    const close = src.indexOf("]", pos);
    return close >= 0 ? close + 1 : pos;
  }
  return pos;
}

// --- Preamble extraction ---

interface PreambleResult {
  title: string;
  authors: string;
  date: string;
  bodyStart: number;
  bodyEnd: number;
  preamble: string;
}

function extractPreamble(src: string): PreambleResult {
  let title = "";
  let authors = "";
  let date = "";

  const bodyStartMatch = src.indexOf("\\begin{document}");
  const bodyEndMatch = src.indexOf("\\end{document}");

  const bodyStart =
    bodyStartMatch >= 0
      ? bodyStartMatch + "\\begin{document}".length
      : 0;
  const bodyEnd = bodyEndMatch >= 0 ? bodyEndMatch : src.length;
  const preamble = bodyStartMatch >= 0 ? src.slice(0, bodyStartMatch) : "";

  // Extract metadata from preamble
  const titleMatch = preamble.match(/\\title\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  if (titleMatch) title = titleMatch[1];

  const authorMatch = preamble.match(/\\author\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  if (authorMatch) authors = authorMatch[1];

  const dateMatch = preamble.match(/\\date\{([^}]*)\}/);
  if (dateMatch) date = dateMatch[1];

  return { title, authors, date, bodyStart, bodyEnd, preamble };
}

// --- Body parser ---

const FORMATTING_COMMANDS: Record<string, LatexNodeType> = {
  textbf: "textbf",
  textit: "textit",
  emph: "emph",
  textsuperscript: "textsuperscript",
  textsubscript: "textsubscript",
  underline: "underline",
};

const SECTION_COMMANDS: Record<string, LatexNodeType> = {
  section: "section",
  subsection: "subsection",
  subsubsection: "subsubsection",
};

const SPECIAL_CHARS: Record<string, string> = {
  "%": "%",
  "&": "&",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  "\\": "\n", // line break
};

function parseBody(src: string, start: number, end: number): LatexNode[] {
  const nodes: LatexNode[] = [];
  let i = start;

  // Skip leading whitespace/newlines
  while (i < end && /\s/.test(src[i])) i++;

  while (i < end) {
    // Skip \maketitle
    if (src.startsWith("\\maketitle", i)) {
      i += "\\maketitle".length;
      while (i < end && /\s/.test(src[i])) i++;
      continue;
    }

    // LaTeX comment line
    if (src[i] === "%" || (src[i] === "\n" && i + 1 < end && src[i + 1] === "%")) {
      const lineStart = src[i] === "%" ? i : i + 1;
      let lineEnd = src.indexOf("\n", lineStart);
      if (lineEnd < 0 || lineEnd > end) lineEnd = end;
      nodes.push(
        node("comment", src.slice(lineStart, lineEnd), { start: lineStart, end: lineEnd })
      );
      i = lineEnd + 1;
      continue;
    }

    // Environment blocks
    if (src.startsWith("\\begin{", i)) {
      const envStart = i;
      const braceEnd = src.indexOf("}", i + 7);
      if (braceEnd < 0) break;
      const envName = src.slice(i + 7, braceEnd);
      const contentStart = braceEnd + 1;
      const endTag = `\\end{${envName}}`;
      const envEnd = src.indexOf(endTag, contentStart);
      if (envEnd < 0) break;
      const fullEnd = envEnd + endTag.length;

      if (envName === "abstract") {
        const innerNodes = parseInlineContent(src, contentStart, envEnd);
        nodes.push(
          node("abstract", src.slice(contentStart, envEnd).trim(), { start: envStart, end: fullEnd }, innerNodes)
        );
      } else if (envName === "itemize" || envName === "enumerate") {
        const items = parseListItems(src, contentStart, envEnd);
        nodes.push(
          node(
            envName as "itemize" | "enumerate",
            src.slice(envStart, fullEnd),
            { start: envStart, end: fullEnd },
            items
          )
        );
      } else if (envName === "equation" || envName === "equation*" || envName === "align" || envName === "align*") {
        const mathContent = src.slice(contentStart, envEnd).trim();
        nodes.push(
          node("math-display", mathContent, { start: envStart, end: fullEnd })
        );
      } else {
        // Unknown environment - render content as paragraph
        const innerNodes = parseInlineContent(src, contentStart, envEnd);
        nodes.push(
          node("paragraph", src.slice(contentStart, envEnd).trim(), { start: envStart, end: fullEnd }, innerNodes)
        );
      }
      i = fullEnd;
      while (i < end && /\s/.test(src[i])) i++;
      continue;
    }

    // Section commands
    if (src[i] === "\\") {
      const { name, end: cmdEnd } = readCommand(src, i);
      if (SECTION_COMMANDS[name]) {
        const optEnd = skipOptional(src, cmdEnd);
        const braced = extractBraced(src, optEnd);
        if (braced) {
          const sectionTitle = braced.text;
          const inlineNodes = parseInlineContent(src, optEnd + 1, braced.end - 1);
          nodes.push(
            node(
              SECTION_COMMANDS[name],
              sectionTitle,
              { start: i, end: braced.end },
              inlineNodes
            )
          );
          i = braced.end;
          while (i < end && /\s/.test(src[i])) i++;
          continue;
        }
      }
    }

    // Paragraph: accumulate text until blank line or section/environment command
    const paraStart = i;
    let paraEnd = i;

    while (paraEnd < end) {
      // Check for double newline (paragraph break)
      if (paraEnd < end - 1 && src[paraEnd] === "\n" && src[paraEnd + 1] === "\n") {
        break;
      }
      // Check for section command or environment at start of line
      if (
        paraEnd > paraStart &&
        src[paraEnd - 1] === "\n" &&
        (src.startsWith("\\section", paraEnd) ||
          src.startsWith("\\subsection", paraEnd) ||
          src.startsWith("\\subsubsection", paraEnd) ||
          src.startsWith("\\begin{", paraEnd) ||
          src.startsWith("\\maketitle", paraEnd) ||
          (src[paraEnd] === "%" && (paraEnd === 0 || src[paraEnd - 1] === "\n")))
      ) {
        break;
      }
      paraEnd++;
    }

    const paraText = src.slice(paraStart, paraEnd).trim();
    if (paraText) {
      const children = parseInlineContent(src, paraStart, paraEnd);
      nodes.push(
        node("paragraph", paraText, { start: paraStart, end: paraEnd }, children)
      );
    }

    i = paraEnd;
    // Skip whitespace
    while (i < end && /\s/.test(src[i])) i++;
  }

  return nodes;
}

function parseListItems(src: string, start: number, end: number): LatexNode[] {
  const items: LatexNode[] = [];
  let i = start;

  while (i < end) {
    while (i < end && /\s/.test(src[i])) i++;
    if (i >= end) break;

    if (src.startsWith("\\item", i)) {
      const itemStart = i;
      i += 5; // skip \item
      // Skip optional label [...]
      i = skipOptional(src, i);
      // Skip space after \item
      if (i < end && src[i] === " ") i++;

      // Collect text until next \item or end
      let itemEnd = i;
      while (itemEnd < end) {
        if (src.startsWith("\\item", itemEnd) && itemEnd > i) break;
        itemEnd++;
      }

      const itemText = src.slice(i, itemEnd).trim();
      const children = parseInlineContent(src, i, itemEnd);
      items.push(
        node("item", itemText, { start: itemStart, end: itemEnd }, children)
      );
      i = itemEnd;
    } else if (src[i] === "%") {
      // Skip comment lines inside lists
      let lineEnd = src.indexOf("\n", i);
      if (lineEnd < 0 || lineEnd > end) lineEnd = end;
      i = lineEnd + 1;
    } else {
      i++;
    }
  }

  return items;
}

function parseInlineContent(src: string, start: number, end: number): LatexNode[] {
  const nodes: LatexNode[] = [];
  let i = start;
  let textStart = i;

  function flushText() {
    if (i > textStart) {
      const text = src.slice(textStart, i);
      const trimmed = text.replace(/\s+/g, " ");
      if (trimmed.trim()) {
        nodes.push(node("text", trimmed, { start: textStart, end: i }));
      }
    }
  }

  while (i < end) {
    // Inline math $...$
    if (src[i] === "$") {
      flushText();
      if (src[i + 1] === "$") {
        // Display math $$...$$
        const mathStart = i;
        const mathEnd = src.indexOf("$$", i + 2);
        if (mathEnd >= 0 && mathEnd <= end) {
          nodes.push(
            node("math-display", src.slice(i + 2, mathEnd), {
              start: mathStart,
              end: mathEnd + 2,
            })
          );
          i = mathEnd + 2;
        } else {
          i += 2;
        }
      } else {
        const mathStart = i;
        const mathEnd = src.indexOf("$", i + 1);
        if (mathEnd >= 0 && mathEnd <= end) {
          nodes.push(
            node("math-inline", src.slice(i + 1, mathEnd), {
              start: mathStart,
              end: mathEnd + 1,
            })
          );
          i = mathEnd + 1;
        } else {
          i++;
        }
      }
      textStart = i;
      continue;
    }

    // Commands
    if (src[i] === "\\") {
      const { name, end: cmdEnd } = readCommand(src, i);

      // Special characters
      if (SPECIAL_CHARS[name] !== undefined) {
        flushText();
        nodes.push(
          node("text", SPECIAL_CHARS[name], { start: i, end: cmdEnd })
        );
        i = cmdEnd;
        textStart = i;
        continue;
      }

      // Formatting commands with braced arg
      if (FORMATTING_COMMANDS[name]) {
        flushText();
        const braced = extractBraced(src, cmdEnd);
        if (braced) {
          const inner = parseInlineContent(src, cmdEnd + 1, braced.end - 1);
          nodes.push(
            node(FORMATTING_COMMANDS[name], braced.text, { start: i, end: braced.end }, inner)
          );
          i = braced.end;
          textStart = i;
          continue;
        }
      }

      // \cite, \ref, \label - render as bracketed reference
      if (name === "cite" || name === "ref" || name === "label") {
        flushText();
        const braced = extractBraced(src, cmdEnd);
        if (braced) {
          nodes.push(
            node("unknown-command", `\\${name}{${braced.text}}`, {
              start: i,
              end: braced.end,
            })
          );
          i = braced.end;
          textStart = i;
          continue;
        }
      }

      // \( ... \) inline math
      if (name === "(") {
        flushText();
        const mathEnd = src.indexOf("\\)", i + 2);
        if (mathEnd >= 0 && mathEnd <= end) {
          nodes.push(
            node("math-inline", src.slice(i + 2, mathEnd), {
              start: i,
              end: mathEnd + 2,
            })
          );
          i = mathEnd + 2;
          textStart = i;
          continue;
        }
      }

      // \[ ... \] display math
      if (name === "[") {
        flushText();
        const mathEnd = src.indexOf("\\]", i + 2);
        if (mathEnd >= 0 && mathEnd <= end) {
          nodes.push(
            node("math-display", src.slice(i + 2, mathEnd), {
              start: i,
              end: mathEnd + 2,
            })
          );
          i = mathEnd + 2;
          textStart = i;
          continue;
        }
      }

      // Unknown commands with braced arg
      if (cmdEnd < end && src[cmdEnd] === "{") {
        flushText();
        const braced = extractBraced(src, cmdEnd);
        if (braced) {
          nodes.push(
            node("unknown-command", `\\${name}{${braced.text}}`, {
              start: i,
              end: braced.end,
            })
          );
          i = braced.end;
          textStart = i;
          continue;
        }
      }

      // Simple command with no braces - skip it, treat as text
      // (things like \rightarrow, \pm, etc. inside math are already handled by KaTeX)
      // Outside math, just render the command name
      flushText();
      nodes.push(
        node("text", `\\${name}`, { start: i, end: cmdEnd })
      );
      i = cmdEnd;
      textStart = i;
      continue;
    }

    // % comment - skip rest of line
    if (src[i] === "%" && (i === 0 || src[i - 1] !== "\\")) {
      flushText();
      let lineEnd = src.indexOf("\n", i);
      if (lineEnd < 0 || lineEnd > end) lineEnd = end;
      nodes.push(node("comment", src.slice(i, lineEnd), { start: i, end: lineEnd }));
      i = lineEnd + 1;
      textStart = i;
      continue;
    }

    i++;
  }

  flushText();
  return nodes;
}

/** Main parse function */
export function parseLatex(src: string): ParseResult {
  pid = 0;
  const { title, authors, date, bodyStart, bodyEnd, preamble } =
    extractPreamble(src);

  const bodyNodes = parseBody(src, bodyStart, bodyEnd);

  return {
    nodes: bodyNodes,
    metadata: { title, authors, date },
    preamble,
  };
}

/** Get plain text for a node (strips all formatting) */
export function getPlainText(n: LatexNode): string {
  if (n.type === "comment") return "";
  if (n.type === "math-inline") return `$${n.content}$`;
  if (n.type === "math-display") return `$$${n.content}$$`;
  if (n.type === "unknown-command") return n.content;
  if (n.children.length === 0) return n.content;
  return n.children.map(getPlainText).join("");
}
