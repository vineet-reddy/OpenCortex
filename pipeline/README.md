# Neuroscience Paper Extraction Pipeline

Extracts key ideas and potential breakthroughs from neuroscience papers (PDF + LaTeX).

## Usage

```powershell
python -m pipeline.extract --tex path\to\paper.tex --pdf path\to\paper.pdf --out extraction.json --report report.md
```

Options:
- `--top-key-ideas` (default 5)
- `--top-breakthroughs` (default 3)

## Notes
- LaTeX is preferred for structured parsing. PDF is used as a fallback.
- PDF extraction requires either `pdfplumber` or `pymupdf`.
- Leaderboard fields are placeholders for the future PageRank-style scoring.

## API (FastAPI)

Requires: `fastapi` + `uvicorn` + `pymupdf`

```powershell
python -m uvicorn pipeline.api:app --host 0.0.0.0 --port 8000
```

Open UI:
- `http://127.0.0.1:8000/ui`
- `/` also serves the same UI

POST `/extract` with multipart form fields:
- `pdf` (required)
- `tex` (optional)

Limits:
- Max 100 PDF pages (enforced server-side)

### Leaderboard API

POST `/leaderboard` with JSON payload:
- `papers`: list of papers with `paper_id`, optional metadata, `novelty_score`, `evidence_score`, and citations per source
- `edges`: directed links (`source_id -> target_id`) where `kind` is `"citation"` or `"llm_inferred"`
- `citation_policy`: `"max"` (default) or `"mean"` for merging citation sources
- `edge_weights` and `impact_weights` are optional tuning overrides
 - `reference_citations` (optional): list of citation sources for referenced papers to compute inherited citations
 - `reference_weights` (optional): list of weights (same length as `reference_citations`) for weighted-mean inheritance

Example:

```json
{
  "papers": [
    {
      "paper_id": "paper-a",
      "title": "Neural Dynamics A",
      "doi": "10.1000/example.a",
      "novelty_score": 0.62,
      "evidence_score": 0.71,
      "citations": {
        "openalex": 25,
        "semantic_scholar": 22,
        "scholar_csv": 24
      },
      "reference_citations": [
        {"openalex": 120, "semantic_scholar": 110},
        {"openalex": 35, "semantic_scholar": 40}
      ],
      "reference_weights": [0.7, 0.3]
    },
    {
      "paper_id": "paper-b",
      "title": "Neural Dynamics B",
      "doi": "10.1000/example.b",
      "novelty_score": 0.43,
      "evidence_score": 0.66,
      "citations": {
        "openalex": 40
      }
    }
  ],
  "edges": [
    {"source_id": "paper-a", "target_id": "paper-b", "kind": "citation", "confidence": 1.0},
    {"source_id": "paper-b", "target_id": "paper-a", "kind": "llm_inferred", "confidence": 0.6}
  ],
  "citation_policy": "max"
}
```

Ranking model:
- Weighted PageRank runs over the `edges` graph.
- Citation counts define personalization priors (log-scaled).
- Final impact score combines PageRank + evidence + novelty.
- Default formula: `impact = 0.7 * pagerank + 0.2 * evidence + 0.1 * novelty`.

Citation source guidance:
- Use OpenAlex and Semantic Scholar as primary machine-readable sources.
- Use Google Scholar numbers as optional user-provided CSV input (`scholar_csv`) rather than automated scraping.

## Output
- `extraction.json`: structured claims and evidence
- `report.md`: human-readable report
