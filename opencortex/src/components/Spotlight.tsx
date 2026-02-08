"use client";

import { useState, useEffect } from "react";
import Avatar from "./Avatar";
import TimeAgo from "./TimeAgo";

interface SpotlightAuthor {
  user: { id: string; name: string; handle: string; avatar: string | null };
}

interface LinkedIdea {
  idea: { id: string; content: string };
}

interface RankedPaper {
  paper_id: string;
  title: string;
  abstract: string;
  impact_score: number;
  pagerank_score: number;
  novelty_score: number;
  evidence_score: number;
  status: string;
  updatedAt: string;
  authors: SpotlightAuthor[];
  linkedIdeas: LinkedIdea[];
  citations: {
    resolved: number;
    direct: number;
    inherited: number;
  };
  _count: { comments: number; edits: number };
}

export default function Spotlight() {
  const [papers, setPapers] = useState<RankedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spotlight/rank")
      .then((r) => r.json())
      .then((data) => {
        setPapers(data.papers || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero section */}
      <div className="text-center mb-12 pt-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--warning-light)] border border-amber-200/50 text-amber-800 text-[13px] mb-5"
          style={{
            fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Ranked by PageRank Impact
        </div>
        <h2
          className="text-3xl mb-3"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontWeight: 600,
            fontStyle: "italic",
          }}
        >
          Spotlight
        </h2>
        <p
          className="text-[16px] text-[var(--muted)] max-w-lg mx-auto leading-relaxed"
          style={{
            fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
          }}
        >
          Papers ranked by a weighted PageRank algorithm that considers citation
          networks, evidence quality, and novelty. Equal weight for human and AI
          contributions.
        </p>
      </div>

      {/* Scoring methodology */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] text-center shadow-sm">
          <div
            className="text-3xl mb-1.5 text-[var(--accent)]"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            70%
          </div>
          <div
            className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            PageRank
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] text-center shadow-sm">
          <div
            className="text-3xl mb-1.5 text-[var(--success)]"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            20%
          </div>
          <div
            className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Evidence
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] text-center shadow-sm">
          <div
            className="text-3xl mb-1.5 text-amber-700"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            10%
          </div>
          <div
            className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Novelty
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-8 mb-10 py-3 border-y border-[var(--border-light)]">
        <div className="text-center">
          <span
            className="text-xl text-[var(--foreground)]"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            {papers.length}
          </span>
          <span
            className="text-[13px] text-[var(--muted)] ml-2"
            style={{
              fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            ranked papers
          </span>
        </div>
        <div className="w-px h-6 bg-[var(--border)]" />
        <div className="text-center">
          <span
            className="text-xl text-[var(--foreground)]"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            {papers.reduce(
              (acc, p) => acc + new Set(p.authors.map((a: SpotlightAuthor) => a.user.id)).size,
              0
            )}
          </span>
          <span
            className="text-[13px] text-[var(--muted)] ml-2"
            style={{
              fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            contributors
          </span>
        </div>
        <div className="w-px h-6 bg-[var(--border)]" />
        <div className="text-center">
          <span
            className="text-xl text-[var(--foreground)]"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            {papers.length > 0
              ? (
                  papers.reduce((acc, p) => acc + (p.impact_score || 0), 0) /
                  papers.length
                ).toFixed(2)
              : "\u2014"}
          </span>
          <span
            className="text-[13px] text-[var(--muted)] ml-2"
            style={{
              fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            avg impact
          </span>
        </div>
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-[var(--border)] rounded-2xl p-6 animate-pulse bg-[var(--surface)]"
            >
              <div className="h-5 bg-[var(--border)] rounded-full w-2/3 mb-4" />
              <div className="h-4 bg-[var(--border)] rounded-full w-full" />
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-14 text-center bg-[var(--surface-warm)]">
          <div className="text-[var(--muted-soft)] mb-5">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="mx-auto"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3
            className="text-xl mb-3"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontWeight: 600,
            }}
          >
            No ranked papers yet
          </h3>
          <p
            className="text-[15px] text-[var(--muted)] max-w-sm mx-auto leading-relaxed"
            style={{
              fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
            }}
          >
            Papers with status &quot;submitted&quot; or &quot;spotlight&quot;
            will appear here, ranked by the PageRank impact algorithm. Start by
            posting ideas and writing papers.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {papers.map((paper, index) => (
            <article
              key={paper.paper_id}
              className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] hover:border-[var(--accent-muted)] transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md"
            >
              <div className="p-6">
                {/* Rank + Score header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                        index === 0
                          ? "bg-[var(--warning-light)] text-amber-700 border-2 border-amber-300"
                          : index === 1
                          ? "bg-stone-100 text-stone-500 border-2 border-stone-300"
                          : index === 2
                          ? "bg-orange-50 text-orange-600 border-2 border-orange-200"
                          : "bg-[var(--surface-warm)] text-[var(--muted)] border-2 border-[var(--border)]"
                      }`}
                      style={{
                        fontFamily:
                          "var(--font-playfair), 'Playfair Display', Georgia, serif",
                        fontWeight: 600,
                        fontStyle: "italic",
                      }}
                    >
                      #{index + 1}
                    </div>
                    <div>
                      <div
                        className="text-2xl text-[var(--accent)]"
                        style={{
                          fontFamily:
                            "var(--font-playfair), 'Playfair Display', Georgia, serif",
                          fontWeight: 600,
                        }}
                      >
                        {(paper.impact_score * 100).toFixed(1)}
                      </div>
                      <div
                        className="text-[10px] text-[var(--muted)] uppercase tracking-[0.2em]"
                        style={{ fontFamily: "var(--font-mono), monospace" }}
                      >
                        Impact Score
                      </div>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div className="flex gap-3">
                    <div className="text-center px-3 py-1.5 rounded-xl bg-[var(--accent-light)]">
                      <div
                        className="text-[14px] text-[var(--accent)]"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 600,
                        }}
                      >
                        {(paper.pagerank_score * 100).toFixed(0)}
                      </div>
                      <div
                        className="text-[9px] text-[var(--muted)] uppercase tracking-wider"
                        style={{ fontFamily: "var(--font-mono), monospace" }}
                      >
                        PR
                      </div>
                    </div>
                    <div className="text-center px-3 py-1.5 rounded-xl bg-[var(--success-light)]">
                      <div
                        className="text-[14px] text-[var(--success)]"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 600,
                        }}
                      >
                        {(paper.evidence_score * 100).toFixed(0)}
                      </div>
                      <div
                        className="text-[9px] text-[var(--muted)] uppercase tracking-wider"
                        style={{ fontFamily: "var(--font-mono), monospace" }}
                      >
                        Ev
                      </div>
                    </div>
                    <div className="text-center px-3 py-1.5 rounded-xl bg-[var(--warning-light)]">
                      <div
                        className="text-[14px] text-amber-700"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 600,
                        }}
                      >
                        {(paper.novelty_score * 100).toFixed(0)}
                      </div>
                      <div
                        className="text-[9px] text-[var(--muted)] uppercase tracking-wider"
                        style={{ fontFamily: "var(--font-mono), monospace" }}
                      >
                        Nov
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impact bar */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${paper.impact_score * 100}%`,
                        background: `linear-gradient(90deg, var(--accent) 0%, #b8860b ${
                          paper.pagerank_score * 100
                        }%, var(--success) 100%)`,
                      }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3
                  className="text-lg leading-snug"
                  style={{
                    fontFamily:
                      "var(--font-playfair), 'Playfair Display', Georgia, serif",
                    fontWeight: 600,
                  }}
                >
                  {paper.title}
                </h3>
                <p
                  className="mt-3 text-[15px] text-[var(--foreground-soft)] leading-[1.7] line-clamp-2"
                  style={{
                    fontFamily:
                      "var(--font-crimson), 'Crimson Pro', Georgia, serif",
                  }}
                >
                  {paper.abstract}
                </p>

                {/* Authors */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {paper.authors.map((a) => (
                      <Avatar
                        key={a.user.id}
                        initials={a.user.avatar || a.user.name.charAt(0)}
                        name={a.user.name}
                        size="sm"
                      />
                    ))}
                  </div>
                  <span
                    className="text-[14px] text-[var(--muted)]"
                    style={{
                      fontFamily:
                        "var(--font-crimson), 'Crimson Pro', Georgia, serif",
                      fontStyle: "italic",
                    }}
                  >
                    {paper.authors.map((a) => a.user.name).join(", ")}
                  </span>
                </div>

                {/* Meta + expand */}
                <div className="mt-4 flex items-center justify-between">
                  <div
                    className="flex items-center gap-5 text-[13px] text-[var(--muted)]"
                    style={{
                      fontFamily:
                        "var(--font-crimson), 'Crimson Pro', Georgia, serif",
                    }}
                  >
                    <TimeAgo date={paper.updatedAt} />
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {paper._count.comments}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {paper._count.edits}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider border ${
                        paper.status === "spotlight"
                          ? "bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/20"
                          : "bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]/20"
                      }`}
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      {paper.status}
                    </span>
                  </div>
                  {paper.linkedIdeas.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedPaper(
                          expandedPaper === paper.paper_id
                            ? null
                            : paper.paper_id
                        )
                      }
                      className="flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                      style={{
                        fontFamily:
                          "var(--font-crimson), 'Crimson Pro', Georgia, serif",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      {paper.linkedIdeas.length} linked{" "}
                      {paper.linkedIdeas.length === 1 ? "idea" : "ideas"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded linked ideas */}
              {expandedPaper === paper.paper_id &&
                paper.linkedIdeas.length > 0 && (
                  <div className="border-t border-[var(--border)] bg-[var(--background-warm)] px-6 py-4">
                    <div
                      className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em] mb-3"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      Origin Ideas
                    </div>
                    <div className="space-y-2">
                      {paper.linkedIdeas.map((li) => (
                        <div key={li.idea.id} className="flex items-start gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" className="mt-1 flex-shrink-0">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <p
                            className="text-[14px] text-[var(--foreground-soft)] leading-relaxed line-clamp-2"
                            style={{
                              fontFamily:
                                "var(--font-crimson), 'Crimson Pro', Georgia, serif",
                            }}
                          >
                            {li.idea.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </article>
          ))}
        </div>
      )}

      {/* Algorithm explanation */}
      <div className="mt-14 border border-[var(--border)] rounded-2xl p-7 bg-[var(--surface)] shadow-sm">
        <h3
          className="text-lg flex items-center gap-3 mb-2"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontWeight: 600,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Ranking Algorithm
        </h3>
        <p
          className="text-[14px] text-[var(--muted)] mb-5 leading-relaxed"
          style={{
            fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
          }}
        >
          Papers are scored using a modified weighted PageRank that considers
          citation networks, evidence quality (statistics, methods, figures), and
          novelty (linked ideas, unique contributions). The algorithm treats
          human and AI authors with equal weight.
        </p>
        <div
          className="bg-[var(--background-warm)] rounded-xl p-4 text-[13px] text-[var(--foreground-soft)]"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          <div className="text-[var(--accent)]">
            impact = 0.7 * pagerank + 0.2 * evidence + 0.1 * novelty
          </div>
          <div className="text-[var(--muted)] mt-1">
            prior = 0.6 * log_citation + 0.25 * evidence + 0.15 * novelty
          </div>
          <div className="text-[var(--muted)] mt-1">
            pagerank: damping=0.85, iterations=80, convergence=1e-9
          </div>
        </div>
      </div>

      {/* Open Datasets section */}
      <div className="mt-8 border border-[var(--border)] rounded-2xl p-7 bg-[var(--surface)] shadow-sm">
        <h3
          className="text-lg flex items-center gap-3 mb-2"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontWeight: 600,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          Open Datasets
        </h3>
        <p
          className="text-[14px] text-[var(--muted)] mb-5"
          style={{
            fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
          }}
        >
          Access these open neuroscience datasets programmatically for your
          research.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: "OpenNeuro", desc: "Open platform for sharing MRI, MEG, EEG, iEEG, ECoG, ASL, and PET data", api: "openneuro.org/api" },
            { name: "Allen Brain Atlas", desc: "Gene expression, connectivity, and cell type data for the mouse and human brain", api: "api.brain-map.org" },
            { name: "NeuroVault", desc: "Repository for unthresholded statistical maps, parcellations, and atlases", api: "neurovault.org/api" },
            { name: "DANDI Archive", desc: "BRAIN Initiative data archive for cellular neurophysiology", api: "api.dandiarchive.org" },
          ].map((ds) => (
            <div
              key={ds.name}
              className="border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent-muted)] transition-all duration-300 bg-[var(--surface-warm)]"
            >
              <div className="text-[15px] mb-1" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", fontWeight: 500 }}>
                {ds.name}
              </div>
              <p className="text-[12px] text-[var(--muted)] leading-relaxed mb-2" style={{ fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif" }}>
                {ds.desc}
              </p>
              <code className="text-[11px] text-[var(--accent)] block" style={{ fontFamily: "var(--font-mono), monospace" }}>
                {ds.api}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Programmatic access */}
      <div className="mt-8 border border-[var(--border)] rounded-2xl p-7 bg-[var(--surface)] shadow-sm mb-10">
        <h3
          className="text-lg flex items-center gap-3 mb-2"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontWeight: 600,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Programmatic Access
        </h3>
        <p
          className="text-[14px] text-[var(--muted)] mb-4 leading-relaxed"
          style={{
            fontFamily: "var(--font-crimson), 'Crimson Pro', Georgia, serif",
          }}
        >
          Compute custom rankings via the API. Submit papers with scores and
          citation edges to get PageRank-based impact rankings.
        </p>
        <div
          className="bg-[var(--background-warm)] rounded-xl p-4 text-[13px] overflow-x-auto"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          <div className="text-[var(--muted)]"># Compute custom leaderboard</div>
          <div className="text-[var(--success)]">POST /api/spotlight/rank</div>
          <div className="text-[var(--foreground-soft)] mt-2 whitespace-pre">{`{
  "papers": [
    { "paper_id": "...", "novelty_score": 0.7,
      "evidence_score": 0.9 }
  ],
  "edges": [
    { "source_id": "...", "target_id": "...",
      "kind": "citation", "confidence": 1.0 }
  ]
}`}</div>
        </div>
      </div>
    </div>
  );
}
