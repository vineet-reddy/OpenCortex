import re
from typing import List, Optional, Tuple

from pipeline.config import Section, SECTION_ALIASES
from pipeline.types import PaperMetadata


LATEX_TITLE_RE = re.compile(r"\\title\*?\{([^}]+)\}")
LATEX_AUTHOR_RE = re.compile(r"\\author\*?\{([^}]+)\}")
LATEX_DATE_RE = re.compile(r"\\date\*?\{([^}]+)\}")
LATEX_SECTION_RE = re.compile(r"\\section\*?\{([^}]+)\}")
LATEX_SUBSECTION_RE = re.compile(r"\\subsection\*?\{([^}]+)\}")


def _strip_latex_comments(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if "%" in line:
            line = line.split("%", 1)[0]
        lines.append(line)
    return "\n".join(lines)


def extract_metadata_from_tex(tex_text: str) -> PaperMetadata:
    title = _first_group(LATEX_TITLE_RE, tex_text)
    authors = _first_group(LATEX_AUTHOR_RE, tex_text)
    year = _first_group(LATEX_DATE_RE, tex_text)
    return PaperMetadata(title=title, authors=authors, year=year)


def _first_group(pattern: re.Pattern, text: str) -> Optional[str]:
    match = pattern.search(text)
    if match:
        return match.group(1).strip()
    return None


def parse_latex_sections(tex_text: str) -> List[Section]:
    text = _strip_latex_comments(tex_text)

    sections: List[Section] = []

    abstract = _extract_abstract(text)
    if abstract:
        sections.append(Section(name="abstract", text=abstract))

    matches = list(LATEX_SECTION_RE.finditer(text))
    if not matches:
        return sections or [Section(name="other", text=text)]

    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        section_title = match.group(1).strip().lower()
        normalized = SECTION_ALIASES.get(section_title, section_title)
        body = text[start:end].strip()
        if body:
            sections.append(Section(name=normalized, text=body))

    return sections


def _extract_abstract(text: str) -> Optional[str]:
    match = re.search(r"\\begin\{abstract\}(.+?)\\end\{abstract\}", text, flags=re.S)
    if match:
        return match.group(1).strip()
    return None


def extract_pdf_pages(pdf_path: str) -> List[Tuple[int, str]]:
    try:
        import pdfplumber  # type: ignore

        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages.append((idx, text))
        return pages
    except ImportError:
        pass

    try:
        import fitz  # type: ignore

        pages = []
        with fitz.open(pdf_path) as doc:
            for idx, page in enumerate(doc, start=1):
                text = page.get_text("text")
                pages.append((idx, text))
        return pages
    except ImportError as exc:
        raise ImportError(
            "PDF extraction requires `pdfplumber` or `pymupdf` (fitz)."
        ) from exc


def sections_from_pdf(pages: List[Tuple[int, str]]) -> List[Section]:
    sections: List[Section] = []
    for page_num, text in pages:
        if text.strip():
            sections.append(Section(name="pdf_page", text=text, page=page_num))
    return sections
