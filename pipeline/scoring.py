from typing import List

from pipeline.claim_extract import classify_breakthrough
from pipeline.types import Claim


def select_key_ideas(claims: List[Claim], top_n: int = 5) -> List[Claim]:
    return sorted(claims, key=lambda c: c.scores.get("total", 0.0), reverse=True)[:top_n]


def select_breakthroughs(claims: List[Claim], top_n: int = 3) -> List[Claim]:
    breakthroughs = [c for c in claims if classify_breakthrough(c)]
    return sorted(breakthroughs, key=lambda c: c.scores.get("total", 0.0), reverse=True)[:top_n]
