from __future__ import annotations

from dataclasses import dataclass, field
from math import log1p
from typing import Dict, List, Optional


DEFAULT_EDGE_WEIGHTS: Dict[str, float] = {
    "citation": 1.0,
    "llm_inferred": 0.5,
}

DEFAULT_IMPACT_WEIGHTS: Dict[str, float] = {
    "pagerank": 0.7,
    "evidence": 0.2,
    "novelty": 0.1,
}


@dataclass
class CitationCounts:
    openalex: Optional[int] = None
    semantic_scholar: Optional[int] = None
    scholar_csv: Optional[int] = None


@dataclass
class LeaderboardPaper:
    paper_id: str
    title: Optional[str] = None
    doi: Optional[str] = None
    novelty_score: float = 0.0
    evidence_score: float = 0.0
    citations: CitationCounts = field(default_factory=CitationCounts)
    reference_citations: List[CitationCounts] = field(default_factory=list)
    reference_weights: Optional[List[float]] = None


@dataclass
class InfluenceEdge:
    source_id: str
    target_id: str
    kind: str = "citation"
    confidence: float = 1.0


def resolve_citation_count(citations: CitationCounts, policy: str = "max") -> int:
    values = [v for v in (citations.openalex, citations.semantic_scholar, citations.scholar_csv) if v is not None]
    values = [max(0, int(v)) for v in values]
    if not values:
        return 0
    if policy == "max":
        return max(values)
    if policy == "mean":
        return int(round(sum(values) / len(values)))
    raise ValueError(f"Unsupported citation policy: {policy}")


def compute_impact_leaderboard(
    papers: List[LeaderboardPaper],
    edges: List[InfluenceEdge],
    citation_policy: str = "max",
    edge_weights: Optional[Dict[str, float]] = None,
    impact_weights: Optional[Dict[str, float]] = None,
    damping: float = 0.85,
    iterations: int = 80,
    tolerance: float = 1e-9,
) -> List[Dict]:
    if not papers:
        return []

    edge_weights = edge_weights or DEFAULT_EDGE_WEIGHTS
    impact_weights = impact_weights or DEFAULT_IMPACT_WEIGHTS
    _validate_impact_weights(impact_weights)

    paper_ids = [paper.paper_id for paper in papers]
    priors = _build_priors(papers, citation_policy)
    graph = _build_weighted_graph(papers, edges, edge_weights)
    pagerank = _weighted_pagerank(
        paper_ids=paper_ids,
        graph=graph,
        priors=priors,
        damping=damping,
        iterations=iterations,
        tolerance=tolerance,
    )

    max_pr = max(pagerank.values()) if pagerank else 1.0
    if max_pr <= 0.0:
        max_pr = 1.0

    ranked: List[Dict] = []
    for paper in papers:
        pr_norm = pagerank.get(paper.paper_id, 0.0) / max_pr
        novelty = _clamp01(paper.novelty_score)
        evidence = _clamp01(paper.evidence_score)
        direct_citations = resolve_citation_count(paper.citations, citation_policy)
        inherited_citations = resolve_inherited_citations(
            paper.reference_citations,
            citation_policy,
            paper.reference_weights,
        )
        effective_citations = direct_citations if direct_citations > 0 else inherited_citations

        impact = (
            impact_weights["pagerank"] * pr_norm
            + impact_weights["evidence"] * evidence
            + impact_weights["novelty"] * novelty
        )

        ranked.append(
            {
                "paper_id": paper.paper_id,
                "title": paper.title,
                "doi": paper.doi,
                "pagerank_score": round(pr_norm, 6),
                "novelty_score": round(novelty, 6),
                "evidence_score": round(evidence, 6),
                "impact_score": round(_clamp01(impact), 6),
                "citations": {
                    "resolved": effective_citations,
                    "direct": direct_citations,
                    "inherited": inherited_citations,
                    "openalex": paper.citations.openalex,
                    "semantic_scholar": paper.citations.semantic_scholar,
                    "scholar_csv": paper.citations.scholar_csv,
                },
            }
        )

    ranked.sort(key=lambda item: item["impact_score"], reverse=True)
    return ranked


def _build_priors(papers: List[LeaderboardPaper], citation_policy: str) -> Dict[str, float]:
    raw: Dict[str, float] = {}
    for paper in papers:
        direct_citations = resolve_citation_count(paper.citations, citation_policy)
        inherited_citations = resolve_inherited_citations(
            paper.reference_citations,
            citation_policy,
            paper.reference_weights,
        )
        citation_count = direct_citations if direct_citations > 0 else inherited_citations
        citation_signal = _citation_signal(citation_count)
        novelty = _clamp01(paper.novelty_score)
        evidence = _clamp01(paper.evidence_score)
        raw[paper.paper_id] = 0.6 * citation_signal + 0.25 * evidence + 0.15 * novelty

    total = sum(raw.values())
    if total <= 0:
        uniform = 1.0 / len(papers)
        return {paper.paper_id: uniform for paper in papers}
    return {paper_id: score / total for paper_id, score in raw.items()}


def _citation_signal(citation_count: int) -> float:
    # Log scaling avoids domination by very old or highly cited outliers.
    return _clamp01(log1p(max(0, citation_count)) / log1p(10000))


def resolve_inherited_citations(
    reference_citations: List[CitationCounts],
    citation_policy: str,
    reference_weights: Optional[List[float]] = None,
) -> int:
    if not reference_citations:
        return 0

    resolved = [resolve_citation_count(citation, citation_policy) for citation in reference_citations]
    weights = _normalize_reference_weights(resolved, reference_weights)
    if not weights:
        return 0
    weighted_total = sum(value * weight for value, weight in zip(resolved, weights))
    return int(round(weighted_total / sum(weights)))


def _normalize_reference_weights(values: List[int], weights: Optional[List[float]]) -> List[float]:
    if weights is None:
        return [1.0 for _ in values if _ is not None]
    if len(weights) != len(values):
        raise ValueError("reference_weights length must match reference_citations length.")
    normalized = []
    for weight in weights:
        if weight is None:
            normalized.append(0.0)
        else:
            normalized.append(max(0.0, float(weight)))
    if sum(normalized) <= 0:
        return []
    return normalized


def _build_weighted_graph(
    papers: List[LeaderboardPaper],
    edges: List[InfluenceEdge],
    edge_weights: Dict[str, float],
) -> Dict[str, Dict[str, float]]:
    valid_ids = {paper.paper_id for paper in papers}
    graph: Dict[str, Dict[str, float]] = {paper.paper_id: {} for paper in papers}

    for edge in edges:
        if edge.source_id not in valid_ids or edge.target_id not in valid_ids:
            continue
        if edge.source_id == edge.target_id:
            continue

        base = edge_weights.get(edge.kind, edge_weights.get("llm_inferred", 0.3))
        confidence = _clamp01(edge.confidence)
        weight = max(0.0, base) * max(0.05, confidence)
        if weight <= 0:
            continue

        graph[edge.source_id][edge.target_id] = graph[edge.source_id].get(edge.target_id, 0.0) + weight

    return graph


def _weighted_pagerank(
    paper_ids: List[str],
    graph: Dict[str, Dict[str, float]],
    priors: Dict[str, float],
    damping: float,
    iterations: int,
    tolerance: float,
) -> Dict[str, float]:
    n = len(paper_ids)
    if n == 0:
        return {}

    damping = min(max(damping, 0.01), 0.99)
    rank = {paper_id: 1.0 / n for paper_id in paper_ids}

    for _ in range(iterations):
        next_rank = {paper_id: (1.0 - damping) * priors.get(paper_id, 0.0) for paper_id in paper_ids}
        sink_mass = 0.0

        for source_id in paper_ids:
            outgoing = graph.get(source_id, {})
            total_weight = sum(outgoing.values())
            if total_weight <= 0:
                sink_mass += damping * rank[source_id]
                continue

            for target_id, weight in outgoing.items():
                next_rank[target_id] += damping * rank[source_id] * (weight / total_weight)

        if sink_mass > 0:
            for paper_id in paper_ids:
                next_rank[paper_id] += sink_mass * priors.get(paper_id, 0.0)

        delta = sum(abs(next_rank[paper_id] - rank[paper_id]) for paper_id in paper_ids)
        rank = next_rank
        if delta <= tolerance:
            break

    total = sum(rank.values())
    if total > 0:
        rank = {paper_id: value / total for paper_id, value in rank.items()}
    return rank


def _validate_impact_weights(impact_weights: Dict[str, float]) -> None:
    required = {"pagerank", "evidence", "novelty"}
    missing = required.difference(impact_weights.keys())
    if missing:
        raise ValueError(f"Missing impact weight keys: {sorted(missing)}")
    if any(value < 0 for value in impact_weights.values()):
        raise ValueError("Impact weights must be non-negative.")
    total = sum(impact_weights.values())
    if total <= 0:
        raise ValueError("Impact weights must sum to a positive value.")


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))
