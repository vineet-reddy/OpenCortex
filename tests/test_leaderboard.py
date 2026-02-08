import unittest

from pipeline.leaderboard import (
    CitationCounts,
    InfluenceEdge,
    LeaderboardPaper,
    compute_impact_leaderboard,
    resolve_citation_count,
)


class LeaderboardTests(unittest.TestCase):
    def test_weighted_pagerank_promotes_central_paper(self) -> None:
        papers = [
            LeaderboardPaper(
                paper_id="p1",
                title="Paper 1",
                novelty_score=0.4,
                evidence_score=0.5,
                citations=CitationCounts(openalex=10),
            ),
            LeaderboardPaper(
                paper_id="p2",
                title="Paper 2",
                novelty_score=0.5,
                evidence_score=0.6,
                citations=CitationCounts(openalex=10),
            ),
            LeaderboardPaper(
                paper_id="p3",
                title="Paper 3",
                novelty_score=0.3,
                evidence_score=0.5,
                citations=CitationCounts(openalex=10),
            ),
        ]
        edges = [
            InfluenceEdge(source_id="p1", target_id="p2", kind="citation", confidence=1.0),
            InfluenceEdge(source_id="p3", target_id="p2", kind="citation", confidence=1.0),
        ]

        ranked = compute_impact_leaderboard(papers=papers, edges=edges)
        self.assertEqual(ranked[0]["paper_id"], "p2")
        self.assertGreaterEqual(ranked[0]["pagerank_score"], ranked[1]["pagerank_score"])

    def test_citation_policy_resolution(self) -> None:
        citations = CitationCounts(openalex=100, semantic_scholar=50, scholar_csv=80)
        self.assertEqual(resolve_citation_count(citations, policy="max"), 100)
        self.assertEqual(resolve_citation_count(citations, policy="mean"), 77)


if __name__ == "__main__":
    unittest.main()
