// Port of pipeline/leaderboard.py — weighted PageRank impact scoring
// This runs server-side in Next.js API routes (Vercel-compatible)

export interface CitationCounts {
  openalex?: number | null;
  semantic_scholar?: number | null;
  scholar_csv?: number | null;
}

export interface LeaderboardPaper {
  paper_id: string;
  title?: string | null;
  doi?: string | null;
  novelty_score: number;
  evidence_score: number;
  citations: CitationCounts;
  reference_citations?: CitationCounts[];
  reference_weights?: number[] | null;
}

export interface InfluenceEdge {
  source_id: string;
  target_id: string;
  kind?: string;
  confidence?: number;
}

export interface RankedPaper {
  paper_id: string;
  title: string | null | undefined;
  doi: string | null | undefined;
  pagerank_score: number;
  novelty_score: number;
  evidence_score: number;
  impact_score: number;
  citations: {
    resolved: number;
    direct: number;
    inherited: number;
    openalex?: number | null;
    semantic_scholar?: number | null;
    scholar_csv?: number | null;
  };
}

const DEFAULT_EDGE_WEIGHTS: Record<string, number> = {
  citation: 1.0,
  llm_inferred: 0.5,
};

const DEFAULT_IMPACT_WEIGHTS: Record<string, number> = {
  pagerank: 0.7,
  evidence: 0.2,
  novelty: 0.1,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveCitationCount(
  citations: CitationCounts,
  policy: string = "max"
): number {
  const values = [
    citations.openalex,
    citations.semantic_scholar,
    citations.scholar_csv,
  ]
    .filter((v): v is number => v != null)
    .map((v) => Math.max(0, Math.round(v)));

  if (values.length === 0) return 0;
  if (policy === "max") return Math.max(...values);
  if (policy === "mean")
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  throw new Error(`Unsupported citation policy: ${policy}`);
}

function resolveInheritedCitations(
  referenceCitations: CitationCounts[],
  citationPolicy: string,
  referenceWeights?: number[] | null
): number {
  if (!referenceCitations || referenceCitations.length === 0) return 0;

  const resolved = referenceCitations.map((c) =>
    resolveCitationCount(c, citationPolicy)
  );

  let weights: number[];
  if (referenceWeights == null) {
    weights = resolved.map(() => 1.0);
  } else {
    if (referenceWeights.length !== resolved.length)
      throw new Error(
        "reference_weights length must match reference_citations length."
      );
    weights = referenceWeights.map((w) => (w == null ? 0 : Math.max(0, w)));
  }

  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return 0;

  const weightedTotal = resolved.reduce(
    (acc, val, i) => acc + val * weights[i],
    0
  );
  return Math.round(weightedTotal / weightSum);
}

function citationSignal(citationCount: number): number {
  return clamp01(Math.log1p(Math.max(0, citationCount)) / Math.log1p(10000));
}

function buildPriors(
  papers: LeaderboardPaper[],
  citationPolicy: string
): Record<string, number> {
  const raw: Record<string, number> = {};

  for (const paper of papers) {
    const directCitations = resolveCitationCount(
      paper.citations,
      citationPolicy
    );
    const inheritedCitations = resolveInheritedCitations(
      paper.reference_citations || [],
      citationPolicy,
      paper.reference_weights
    );
    const citCount =
      directCitations > 0 ? directCitations : inheritedCitations;
    const cSignal = citationSignal(citCount);
    const novelty = clamp01(paper.novelty_score);
    const evidence = clamp01(paper.evidence_score);
    raw[paper.paper_id] = 0.6 * cSignal + 0.25 * evidence + 0.15 * novelty;
  }

  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const uniform = 1.0 / papers.length;
    return Object.fromEntries(papers.map((p) => [p.paper_id, uniform]));
  }
  return Object.fromEntries(
    Object.entries(raw).map(([id, score]) => [id, score / total])
  );
}

function buildWeightedGraph(
  papers: LeaderboardPaper[],
  edges: InfluenceEdge[],
  edgeWeights: Record<string, number>
): Record<string, Record<string, number>> {
  const validIds = new Set(papers.map((p) => p.paper_id));
  const graph: Record<string, Record<string, number>> = {};
  for (const paper of papers) graph[paper.paper_id] = {};

  for (const edge of edges) {
    if (!validIds.has(edge.source_id) || !validIds.has(edge.target_id))
      continue;
    if (edge.source_id === edge.target_id) continue;

    const base =
      edgeWeights[edge.kind || "citation"] ??
      edgeWeights["llm_inferred"] ??
      0.3;
    const confidence = clamp01(edge.confidence ?? 1.0);
    const weight = Math.max(0, base) * Math.max(0.05, confidence);
    if (weight <= 0) continue;

    graph[edge.source_id][edge.target_id] =
      (graph[edge.source_id][edge.target_id] || 0) + weight;
  }

  return graph;
}

function weightedPageRank(
  paperIds: string[],
  graph: Record<string, Record<string, number>>,
  priors: Record<string, number>,
  damping: number,
  iterations: number,
  tolerance: number
): Record<string, number> {
  const n = paperIds.length;
  if (n === 0) return {};

  damping = Math.min(Math.max(damping, 0.01), 0.99);
  let rank: Record<string, number> = {};
  for (const id of paperIds) rank[id] = 1.0 / n;

  for (let iter = 0; iter < iterations; iter++) {
    const nextRank: Record<string, number> = {};
    for (const id of paperIds)
      nextRank[id] = (1.0 - damping) * (priors[id] || 0);

    let sinkMass = 0;

    for (const sourceId of paperIds) {
      const outgoing = graph[sourceId] || {};
      const totalWeight = Object.values(outgoing).reduce((a, b) => a + b, 0);
      if (totalWeight <= 0) {
        sinkMass += damping * rank[sourceId];
        continue;
      }
      for (const [targetId, weight] of Object.entries(outgoing)) {
        nextRank[targetId] +=
          damping * rank[sourceId] * (weight / totalWeight);
      }
    }

    if (sinkMass > 0) {
      for (const id of paperIds) nextRank[id] += sinkMass * (priors[id] || 0);
    }

    let delta = 0;
    for (const id of paperIds) delta += Math.abs(nextRank[id] - rank[id]);
    rank = nextRank;
    if (delta <= tolerance) break;
  }

  const total = Object.values(rank).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const id of paperIds) rank[id] /= total;
  }
  return rank;
}

export function computeImpactLeaderboard(
  papers: LeaderboardPaper[],
  edges: InfluenceEdge[] = [],
  options: {
    citationPolicy?: string;
    edgeWeights?: Record<string, number>;
    impactWeights?: Record<string, number>;
    damping?: number;
    iterations?: number;
    tolerance?: number;
  } = {}
): RankedPaper[] {
  if (papers.length === 0) return [];

  const {
    citationPolicy = "max",
    edgeWeights = DEFAULT_EDGE_WEIGHTS,
    impactWeights = DEFAULT_IMPACT_WEIGHTS,
    damping = 0.85,
    iterations = 80,
    tolerance = 1e-9,
  } = options;

  const priors = buildPriors(papers, citationPolicy);
  const graph = buildWeightedGraph(papers, edges, edgeWeights);
  const pagerank = weightedPageRank(
    papers.map((p) => p.paper_id),
    graph,
    priors,
    damping,
    iterations,
    tolerance
  );

  let maxPr = Math.max(...Object.values(pagerank));
  if (maxPr <= 0) maxPr = 1;

  const ranked: RankedPaper[] = papers.map((paper) => {
    const prNorm = (pagerank[paper.paper_id] || 0) / maxPr;
    const novelty = clamp01(paper.novelty_score);
    const evidence = clamp01(paper.evidence_score);
    const directCitations = resolveCitationCount(
      paper.citations,
      citationPolicy
    );
    const inheritedCitations = resolveInheritedCitations(
      paper.reference_citations || [],
      citationPolicy,
      paper.reference_weights
    );
    const effectiveCitations =
      directCitations > 0 ? directCitations : inheritedCitations;

    const impact =
      impactWeights.pagerank * prNorm +
      impactWeights.evidence * evidence +
      impactWeights.novelty * novelty;

    return {
      paper_id: paper.paper_id,
      title: paper.title,
      doi: paper.doi,
      pagerank_score: Number(prNorm.toFixed(6)),
      novelty_score: Number(novelty.toFixed(6)),
      evidence_score: Number(evidence.toFixed(6)),
      impact_score: Number(clamp01(impact).toFixed(6)),
      citations: {
        resolved: effectiveCitations,
        direct: directCitations,
        inherited: inheritedCitations,
        openalex: paper.citations.openalex,
        semantic_scholar: paper.citations.semantic_scholar,
        scholar_csv: paper.citations.scholar_csv,
      },
    };
  });

  ranked.sort((a, b) => b.impact_score - a.impact_score);
  return ranked;
}
