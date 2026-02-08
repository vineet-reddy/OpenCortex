from typing import List

from pipeline.types import Claim, ExtractionResult


def _format_claim(claim: Claim) -> str:
    page = f"p.{claim.page}" if claim.page else "p.?"
    cues = ", ".join(claim.cues) if claim.cues else "-"
    return f"- {claim.text} ({claim.section}, {page}, cues: {cues})"


def render_report(result: ExtractionResult) -> str:
    lines: List[str] = []
    lines.append(f"# {result.metadata.title or 'Untitled Paper'}")
    if result.metadata.authors:
        lines.append(f"**Authors:** {result.metadata.authors}")
    if result.metadata.year:
        lines.append(f"**Year:** {result.metadata.year}")
    lines.append("")

    lines.append("## Key Ideas")
    if not result.key_ideas:
        lines.append("- (none detected)")
    else:
        for claim in result.key_ideas:
            lines.append(_format_claim(claim))
    lines.append("")

    lines.append("## Breakthroughs")
    if not result.breakthroughs:
        lines.append("- (none detected)")
    else:
        for claim in result.breakthroughs:
            lines.append(_format_claim(claim))

    lines.append("")
    lines.append("## Leaderboard Fields (stub)")
    for key, value in result.leaderboard_fields.items():
        lines.append(f"- {key}: {value}")

    return "\n".join(lines)
