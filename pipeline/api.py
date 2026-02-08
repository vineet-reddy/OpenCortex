from __future__ import annotations

import tempfile
import uuid
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
import httpx

from pipeline.extract import run_pipeline
from pipeline.leaderboard import (
    CitationCounts,
    InfluenceEdge,
    LeaderboardPaper,
    compute_impact_leaderboard,
)

MAX_PAGES = 100

app = FastAPI(title="AgentScience Extraction API", version="0.1.0")
UI_PATH = Path(__file__).with_name("ui.html")


class CitationCountsPayload(BaseModel):
    openalex: Optional[int] = None
    semantic_scholar: Optional[int] = None
    scholar_csv: Optional[int] = None


class LeaderboardPaperPayload(BaseModel):
    paper_id: str
    title: Optional[str] = None
    doi: Optional[str] = None
    novelty_score: float = 0.0
    evidence_score: float = 0.0
    citations: CitationCountsPayload = Field(default_factory=CitationCountsPayload)


class InfluenceEdgePayload(BaseModel):
    source_id: str
    target_id: str
    kind: str = "citation"
    confidence: float = 1.0


class LeaderboardRequest(BaseModel):
    papers: List[LeaderboardPaperPayload]
    edges: List[InfluenceEdgePayload] = Field(default_factory=list)
    citation_policy: str = "max"
    edge_weights: Optional[Dict[str, float]] = None
    impact_weights: Optional[Dict[str, float]] = None
    damping: float = 0.85
    iterations: int = 80


def _pdf_page_count(pdf_bytes: bytes) -> int:
    try:
        import fitz  # type: ignore

        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            return doc.page_count
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF page counting requires pymupdf to be installed.",
        ) from exc


def _openalex_citation_count(doi: Optional[str], title: Optional[str]) -> Optional[int]:
    headers = {"User-Agent": "AgentScience/0.1"}
    timeout = httpx.Timeout(5.0)
    try:
        with httpx.Client(timeout=timeout) as client:
            if doi:
                doi_url = f"https://api.openalex.org/works/https://doi.org/{quote(doi)}"
                res = client.get(doi_url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    cited_by = data.get("cited_by_count")
                    if isinstance(cited_by, int):
                        return cited_by

            if title:
                res = client.get(
                    "https://api.openalex.org/works",
                    params={"search": title, "per-page": 1},
                    headers=headers,
                )
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results") or []
                    if results:
                        cited_by = results[0].get("cited_by_count")
                        if isinstance(cited_by, int):
                            return cited_by
    except Exception:
        return None
    return None


def _openalex_citations_for_idea(idea_text: str) -> Optional[int]:
    if not idea_text:
        return None
    query = " ".join(idea_text.split())
    if len(query) > 280:
        query = query[:280]
    headers = {"User-Agent": "AgentScience/0.1"}
    timeout = httpx.Timeout(5.0)
    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.get(
                "https://api.openalex.org/works",
                params={"search": query, "per-page": 1},
                headers=headers,
            )
            if res.status_code == 200:
                data = res.json()
                results = data.get("results") or []
                if results:
                    cited_by = results[0].get("cited_by_count")
                    if isinstance(cited_by, int):
                        return cited_by
    except Exception:
        return None
    return None


@app.post("/extract")
async def extract(pdf: UploadFile = File(...), tex: Optional[UploadFile] = File(default=None)):
    if pdf.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400, detail="`pdf` must be a PDF file.")

    pdf_bytes = await pdf.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="`pdf` is empty.")

    if _pdf_page_count(pdf_bytes) > MAX_PAGES:
        raise HTTPException(
            status_code=400,
            detail=f"PDF exceeds max page count of {MAX_PAGES}.",
        )

    tex_bytes = await tex.read() if tex else None

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        pdf_path = temp_path / f"{uuid.uuid4()}.pdf"
        pdf_path.write_bytes(pdf_bytes)

        tex_path: Optional[Path] = None
        if tex_bytes:
            tex_path = temp_path / f"{uuid.uuid4()}.tex"
            tex_path.write_bytes(tex_bytes)

        result = run_pipeline(pdf_path=pdf_path, tex_path=tex_path, top_key_ideas=5, top_breakthroughs=3)
        payload = result.to_dict()
        metadata = payload.get("metadata") or {}
        openalex_count = _openalex_citation_count(metadata.get("doi"), metadata.get("title"))
        payload["citations"] = {"openalex": openalex_count}
        for idea in payload.get("key_ideas", []) or []:
            text = idea.get("text") if isinstance(idea, dict) else None
            if not text:
                continue
            citations = _openalex_citations_for_idea(text)
            scores = idea.setdefault("scores", {})
            scores["openalex_citations"] = citations if citations is not None else 0
        return payload


@app.post("/leaderboard")
async def leaderboard(payload: LeaderboardRequest):
    papers = [
        LeaderboardPaper(
            paper_id=item.paper_id,
            title=item.title,
            doi=item.doi,
            novelty_score=item.novelty_score,
            evidence_score=item.evidence_score,
            citations=CitationCounts(
                openalex=item.citations.openalex,
                semantic_scholar=item.citations.semantic_scholar,
                scholar_csv=item.citations.scholar_csv,
            ),
        )
        for item in payload.papers
    ]
    edges = [
        InfluenceEdge(
            source_id=edge.source_id,
            target_id=edge.target_id,
            kind=edge.kind,
            confidence=edge.confidence,
        )
        for edge in payload.edges
    ]

    try:
        ranked = compute_impact_leaderboard(
            papers=papers,
            edges=edges,
            citation_policy=payload.citation_policy,
            edge_weights=payload.edge_weights,
            impact_weights=payload.impact_weights,
            damping=payload.damping,
            iterations=payload.iterations,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"count": len(ranked), "items": ranked}


@app.get("/", response_class=HTMLResponse)
@app.get("/ui", response_class=HTMLResponse)
async def ui():
    if not UI_PATH.exists():
        raise HTTPException(status_code=500, detail="UI file not found.")
    return UI_PATH.read_text(encoding="utf-8")
