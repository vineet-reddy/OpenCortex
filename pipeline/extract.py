import argparse
import json
import uuid
from pathlib import Path
from typing import List

from pipeline.claim_extract import extract_claims
from pipeline.report import render_report
from pipeline.scoring import select_breakthroughs, select_key_ideas
from pipeline.text_extract import (
    extract_metadata_from_tex,
    extract_pdf_pages,
    parse_latex_sections,
    sections_from_pdf,
)
from pipeline.types import ExtractionResult, PaperMetadata, Claim


def _mean_score(claims: List[Claim], key: str) -> float | None:
    values = [claim.scores[key] for claim in claims if key in claim.scores]
    if not values:
        return None
    return round(sum(values) / len(values), 6)


def _load_tex(tex_path: Path | None) -> tuple[PaperMetadata, List]:
    if not tex_path:
        return PaperMetadata(), []
    tex_text = tex_path.read_text(encoding="utf-8", errors="ignore")
    metadata = extract_metadata_from_tex(tex_text)
    sections = parse_latex_sections(tex_text)
    return metadata, sections


def _load_pdf(pdf_path: Path | None) -> List:
    if not pdf_path:
        return []
    pages = extract_pdf_pages(str(pdf_path))
    return sections_from_pdf(pages)


def run_pipeline(
    pdf_path: Path | None,
    tex_path: Path | None,
    top_key_ideas: int,
    top_breakthroughs: int,
) -> ExtractionResult:
    metadata, tex_sections = _load_tex(tex_path)
    pdf_sections = _load_pdf(pdf_path) if not tex_sections else []

    sections = tex_sections or pdf_sections
    source = "tex" if tex_sections else "pdf"

    claims: List[Claim] = []
    for section in sections:
        claims.extend(extract_claims(section.name, section.text, section.page, source))

    key_ideas = select_key_ideas(claims, top_n=top_key_ideas)
    breakthroughs = select_breakthroughs(claims, top_n=top_breakthroughs)

    leaderboard_fields = {
        "impact_score": None,
        "pagerank_score": None,
        "novelty_score": _mean_score(claims, "novelty"),
        "evidence_score": _mean_score(claims, "evidence"),
    }

    return ExtractionResult(
        paper_id=str(uuid.uuid4()),
        metadata=metadata,
        key_ideas=key_ideas,
        breakthroughs=breakthroughs,
        all_claims=claims,
        leaderboard_fields=leaderboard_fields,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract key ideas and breakthroughs from neuroscience papers.")
    parser.add_argument("--pdf", type=Path, help="Path to paper PDF")
    parser.add_argument("--tex", type=Path, help="Path to main LaTeX source")
    parser.add_argument("--out", type=Path, default=Path("extraction.json"), help="Output JSON path")
    parser.add_argument("--report", type=Path, default=Path("report.md"), help="Output markdown report path")
    parser.add_argument("--top-key-ideas", type=int, default=5)
    parser.add_argument("--top-breakthroughs", type=int, default=3)

    args = parser.parse_args()

    if not args.pdf and not args.tex:
        raise SystemExit("Provide --pdf and/or --tex")

    result = run_pipeline(args.pdf, args.tex, args.top_key_ideas, args.top_breakthroughs)

    args.out.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
    args.report.write_text(render_report(result), encoding="utf-8")


if __name__ == "__main__":
    main()
