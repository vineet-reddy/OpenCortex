import re
from typing import List

from pipeline.config import (
    BREAKTHROUGH_CUES,
    CUE_PHRASES,
    EVIDENCE_PATTERNS,
    NEUROSCIENCE_KEYWORDS,
    SECTION_WEIGHTS,
)
from pipeline.types import Claim, Evidence


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> List[str]:
    raw = _SENTENCE_SPLIT_RE.split(text.replace("\n", " "))
    return [s.strip() for s in raw if len(s.strip()) > 0]


def extract_claims(section_name: str, text: str, page: int | None, source: str) -> List[Claim]:
    sentences = split_sentences(text)
    claims: List[Claim] = []
    for sentence in sentences:
        cues = _find_cues(sentence)
        if not cues:
            continue
        evidence = _link_evidence(sentence, sentences, section_name, page, source)
        scores = _score_claim(sentence, cues, section_name)
        claims.append(
            Claim(
                text=sentence,
                section=section_name,
                page=page,
                source=source,
                cues=cues,
                evidence=evidence,
                scores=scores,
            )
        )
    return claims


def classify_breakthrough(claim: Claim) -> bool:
    text = claim.text.lower()
    for cue in BREAKTHROUGH_CUES:
        if cue in text:
            return True
    return claim.scores.get("novelty", 0.0) >= 0.6 and claim.scores.get("evidence", 0.0) >= 0.4


def _find_cues(sentence: str) -> List[str]:
    lower = sentence.lower()
    return [cue for cue in CUE_PHRASES if cue in lower]


def _score_claim(sentence: str, cues: List[str], section_name: str) -> dict:
    lower = sentence.lower()
    evidence = 1.0 if _has_evidence(sentence) else 0.0
    novelty = 0.0
    if any(cue in lower for cue in ("novel", "first", "previously unknown")):
        novelty = 0.8
    elif len(cues) >= 2:
        novelty = 0.6
    elif len(cues) == 1:
        novelty = 0.4

    neuroscience = 1.0 if any(k in lower for k in NEUROSCIENCE_KEYWORDS) else 0.3
    section_weight = SECTION_WEIGHTS.get(section_name, SECTION_WEIGHTS["other"])

    total = min(1.0, (0.4 * novelty + 0.3 * evidence + 0.2 * neuroscience + 0.1 * section_weight))
    return {
        "novelty": round(novelty, 3),
        "evidence": round(evidence, 3),
        "neuroscience": round(neuroscience, 3),
        "section_weight": round(section_weight, 3),
        "total": round(total, 3),
    }


def _has_evidence(sentence: str) -> bool:
    lower = sentence.lower()
    if "figure" in lower or "table" in lower:
        return True
    return any(pattern.search(sentence) for pattern in EVIDENCE_PATTERNS)


def _link_evidence(claim_sentence: str, sentences: List[str], section: str, page: int | None, source: str) -> List[Evidence]:
    evidence: List[Evidence] = []
    for sentence in sentences:
        if sentence == claim_sentence:
            continue
        if _has_evidence(sentence):
            evidence.append(Evidence(text=sentence, section=section, page=page, source=source))
    return evidence
