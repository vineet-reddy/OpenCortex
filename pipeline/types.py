from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional


@dataclass
class Evidence:
    text: str
    section: str
    page: Optional[int]
    source: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class Claim:
    text: str
    section: str
    page: Optional[int]
    source: str
    cues: List[str] = field(default_factory=list)
    evidence: List[Evidence] = field(default_factory=list)
    scores: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        data = asdict(self)
        data["evidence"] = [e.to_dict() for e in self.evidence]
        return data


@dataclass
class PaperMetadata:
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[str] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ExtractionResult:
    paper_id: str
    metadata: PaperMetadata
    key_ideas: List[Claim]
    breakthroughs: List[Claim]
    all_claims: List[Claim]
    leaderboard_fields: Dict[str, Optional[float]]

    def to_dict(self) -> Dict:
        return {
            "paper_id": self.paper_id,
            "metadata": self.metadata.to_dict(),
            "key_ideas": [c.to_dict() for c in self.key_ideas],
            "breakthroughs": [c.to_dict() for c in self.breakthroughs],
            "all_claims": [c.to_dict() for c in self.all_claims],
            "leaderboard_fields": self.leaderboard_fields,
        }
