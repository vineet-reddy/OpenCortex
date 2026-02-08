import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  computeImpactLeaderboard,
  type LeaderboardPaper,
  type InfluenceEdge,
} from "@/lib/leaderboard";

// GET: compute rankings for all submitted/spotlight papers using PageRank
export async function GET() {
  try {
    const papers = await prisma.paper.findMany({
      where: {
        status: { in: ["submitted", "spotlight"] },
      },
      include: {
        authors: { include: { user: true } },
        comments: true,
        edits: true,
        linkedIdeas: { include: { idea: true } },
        _count: { select: { comments: true, edits: true } },
      },
    });

    if (papers.length === 0) {
      return NextResponse.json({ count: 0, items: [], papers: [] });
    }

    // Build leaderboard papers with heuristic scores
    const leaderboardPapers: LeaderboardPaper[] = papers.map((paper) => {
      // Heuristic novelty: based on linked ideas count + content length
      const ideaCount = paper.linkedIdeas.length;
      const novelty = Math.min(1.0, 0.3 + ideaCount * 0.2);

      // Heuristic evidence: based on LaTeX content markers
      const latex = paper.latexSource.toLowerCase();
      const hasStats =
        latex.includes("p <") ||
        latex.includes("p=") ||
        latex.includes("anova") ||
        latex.includes("t-test");
      const hasFigures =
        latex.includes("\\begin{figure") || latex.includes("\\includegraphics");
      const hasMethods = latex.includes("\\section{methods");
      const evidence = Math.min(
        1.0,
        (hasStats ? 0.4 : 0) + (hasFigures ? 0.2 : 0) + (hasMethods ? 0.3 : 0) + 0.1
      );

      return {
        paper_id: paper.id,
        title: paper.title,
        novelty_score: novelty,
        evidence_score: evidence,
        citations: { openalex: null, semantic_scholar: null, scholar_csv: null },
      };
    });

    // Build edges from shared authorship and idea linkage
    const edges: InfluenceEdge[] = [];
    for (let i = 0; i < papers.length; i++) {
      for (let j = i + 1; j < papers.length; j++) {
        const authorsI = new Set(papers[i].authors.map((a) => a.userId));
        const authorsJ = new Set(papers[j].authors.map((a) => a.userId));
        const sharedAuthors = [...authorsI].filter((id) => authorsJ.has(id));
        if (sharedAuthors.length > 0) {
          edges.push({
            source_id: papers[i].id,
            target_id: papers[j].id,
            kind: "llm_inferred",
            confidence: Math.min(1.0, sharedAuthors.length * 0.5),
          });
          edges.push({
            source_id: papers[j].id,
            target_id: papers[i].id,
            kind: "llm_inferred",
            confidence: Math.min(1.0, sharedAuthors.length * 0.5),
          });
        }
      }
    }

    const ranked = computeImpactLeaderboard(leaderboardPapers, edges);

    // Merge ranked data with full paper data
    const enriched = ranked.map((r) => {
      const paper = papers.find((p) => p.id === r.paper_id)!;
      return {
        ...r,
        abstract: paper.abstract,
        status: paper.status,
        latexSource: paper.latexSource,
        updatedAt: paper.updatedAt,
        createdAt: paper.createdAt,
        authors: paper.authors,
        linkedIdeas: paper.linkedIdeas,
        _count: paper._count,
      };
    });

    return NextResponse.json({
      count: ranked.length,
      items: ranked,
      papers: enriched,
    });
  } catch (error) {
    console.error("Failed to compute rankings:", error);
    return NextResponse.json(
      { error: "Failed to compute rankings" },
      { status: 500 }
    );
  }
}

// POST: compute rankings with custom parameters
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { papers, edges = [], ...options } = body;

    if (!papers || !Array.isArray(papers)) {
      return NextResponse.json(
        { error: "papers array is required" },
        { status: 400 }
      );
    }

    const ranked = computeImpactLeaderboard(papers, edges, options);
    return NextResponse.json({ count: ranked.length, items: ranked });
  } catch (error) {
    console.error("Failed to compute leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to compute leaderboard" },
      { status: 500 }
    );
  }
}
